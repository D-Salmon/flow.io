#!/usr/bin/python3
"""Loopback-only confirmation page for safely powering off the Flow.io kiosk."""

import argparse
import hmac
import html
import os
import secrets
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, parse_qsl, urlencode, urlsplit, urlunsplit


LISTEN_ADDRESS = "127.0.0.1"
LISTEN_PORT = 8765
SYSTEMCTL = "/usr/bin/systemctl"
MAX_REQUEST_BYTES = 512
CSRF_TOKEN = secrets.token_urlsafe(32)


def kiosk_url(raw_url):
    value = str(raw_url or "").strip()
    parsed = urlsplit(value)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return "http://flowio.local/?flowio_kiosk=rpi"
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["flowio_kiosk"] = "rpi"
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path or "/", urlencode(query), ""))


def confirmation_page(return_url):
    safe_return_url = html.escape(return_url, quote=True)
    safe_token = html.escape(CSRF_TOKEN, quote=True)
    return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Arrêt de l’écran Flow.io</title>
  <style>
    :root {{ color-scheme: light; font-family: Arial, sans-serif; }}
    body {{ min-height:100vh; margin:0; display:grid; place-items:center; background:#0b1f3a; color:#16384f; }}
    main {{ width:min(430px,calc(100% - 32px)); box-sizing:border-box; padding:28px; border-radius:22px; background:#fff; box-shadow:0 18px 48px rgba(0,0,0,.32); }}
    h1 {{ margin:0 0 12px; font-size:25px; }}
    p {{ line-height:1.5; color:#4e657a; }}
    form {{ margin-top:22px; }}
    button,a {{ width:100%; min-height:52px; box-sizing:border-box; border-radius:14px; font-size:16px; font-weight:700; }}
    button {{ position:relative; overflow:hidden; border:0; background:#d14c66; color:#fff; touch-action:none; cursor:pointer; }}
    button::after {{ content:''; position:absolute; inset:0; width:0; background:rgba(255,255,255,.28); }}
    button.is-holding::after {{ width:100%; transition:width 3s linear; }}
    a {{ margin-top:12px; display:flex; align-items:center; justify-content:center; color:#1e5f95; text-decoration:none; background:#e1ecf7; }}
    #holdStatus {{ min-height:24px; margin:12px 0 0; text-align:center; font-weight:700; color:#8a2f45; }}
  </style>
</head>
<body>
  <main>
    <h1>Arrêter l’écran</h1>
    <p>Maintenez le bouton pendant trois secondes. Attendez ensuite l’extinction complète avant de couper l’alimentation.</p>
    <form id="shutdownForm" method="post" action="/shutdown">
      <input type="hidden" name="csrf" value="{safe_token}">
      <button id="holdButton" type="button">Maintenir 3 secondes</button>
    </form>
    <p id="holdStatus" aria-live="polite"></p>
    <a href="{safe_return_url}">Retour à Flow.io</a>
  </main>
  <script src="/shutdown.js"></script>
</body>
</html>"""


def shutdown_page():
    return """<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Arrêt en cours</title><style>
body{min-height:100vh;margin:0;display:grid;place-items:center;background:#0b1f3a;color:#fff;font-family:Arial,sans-serif;text-align:center}
main{padding:28px}h1{font-size:28px}p{font-size:17px;line-height:1.5;color:#d9e5ef}
</style></head><body><main><h1>Arrêt en cours…</h1>
<p>Attendez que l’écran soit complètement éteint avant de couper l’alimentation.</p></main></body></html>"""


SHUTDOWN_JS = """(function () {
  'use strict';
  var form = document.getElementById('shutdownForm');
  var button = document.getElementById('holdButton');
  var status = document.getElementById('holdStatus');
  var timer = null;

  function cancelHold() {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
    button.classList.remove('is-holding');
    status.textContent = '';
  }

  function startHold(event) {
    event.preventDefault();
    if (timer !== null) return;
    button.classList.add('is-holding');
    status.textContent = 'Maintenez le bouton…';
    timer = window.setTimeout(function () {
      timer = null;
      button.disabled = true;
      status.textContent = 'Arrêt demandé…';
      form.requestSubmit();
    }, 3000);
  }

  button.addEventListener('pointerdown', startHold);
  button.addEventListener('pointerup', cancelHold);
  button.addEventListener('pointercancel', cancelHold);
  button.addEventListener('pointerleave', cancelHold);
  button.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' || event.key === ' ') startHold(event);
  });
  button.addEventListener('keyup', function (event) {
    if (event.key === 'Enter' || event.key === ' ') cancelHold();
  });
  button.addEventListener('contextmenu', function (event) { event.preventDefault(); });
}());
"""


def request_poweroff():
    time.sleep(1.0)
    if hasattr(os, "sync"):
        os.sync()
    try:
        result = subprocess.run([SYSTEMCTL, "poweroff"], check=False, timeout=10)
        if result.returncode != 0:
            print(f"systemctl poweroff failed with status {result.returncode}", flush=True)
    except (OSError, subprocess.SubprocessError) as exc:
        print(f"systemctl poweroff failed: {exc}", flush=True)


class ShutdownHandler(BaseHTTPRequestHandler):
    server_version = "FlowioKioskControl/1.0"

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} - {fmt % args}", flush=True)

    def valid_host(self):
        host = self.headers.get("Host", "").lower()
        return host in (
            f"127.0.0.1:{LISTEN_PORT}",
            f"localhost:{LISTEN_PORT}",
            "127.0.0.1",
            "localhost",
        )

    def send_common_headers(self, content_type, content_length):
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(content_length))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; "
            "form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        )

    def send_body(self, status, body, content_type="text/html; charset=utf-8"):
        payload = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(status)
        self.send_common_headers(content_type, len(payload))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if not self.valid_host():
            self.send_error(400)
            return
        if self.path == "/":
            return_url = kiosk_url(os.environ.get("FLOWIO_URL", "http://flowio.local"))
            self.send_body(200, confirmation_page(return_url))
            return
        if self.path == "/shutdown.js":
            self.send_body(200, SHUTDOWN_JS, "application/javascript; charset=utf-8")
            return
        self.send_error(404)

    def do_POST(self):
        if not self.valid_host() or self.path != "/shutdown":
            self.send_error(404)
            return
        origin = self.headers.get("Origin", "")
        if origin and origin not in (
            f"http://127.0.0.1:{LISTEN_PORT}",
            f"http://localhost:{LISTEN_PORT}",
        ):
            self.send_error(403)
            return
        content_type = self.headers.get("Content-Type", "")
        if not content_type.startswith("application/x-www-form-urlencoded"):
            self.send_error(415)
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(400)
            return
        if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
            self.send_error(413)
            return
        try:
            request_body = self.rfile.read(content_length).decode("utf-8")
        except UnicodeDecodeError:
            self.send_error(400)
            return
        fields = parse_qs(request_body, keep_blank_values=True)
        supplied_token = fields.get("csrf", [""])[0]
        if not hmac.compare_digest(supplied_token, CSRF_TOKEN):
            self.send_error(403)
            return
        self.send_body(200, shutdown_page())
        threading.Thread(target=request_poweroff, daemon=True).start()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="validate templates without starting the server")
    args = parser.parse_args()
    if args.check:
        rendered = confirmation_page(kiosk_url(os.environ.get("FLOWIO_URL", "http://flowio.local")))
        if "Maintenir 3 secondes" not in rendered or CSRF_TOKEN not in rendered:
            raise SystemExit("invalid shutdown confirmation template")
        print("Flow.io kiosk shutdown server check: OK")
        return
    server = ThreadingHTTPServer((LISTEN_ADDRESS, LISTEN_PORT), ShutdownHandler)
    print(f"Flow.io kiosk shutdown control listening on http://{LISTEN_ADDRESS}:{LISTEN_PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
