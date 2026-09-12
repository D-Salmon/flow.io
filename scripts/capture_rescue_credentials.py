"""Capture Flow.io Rescue credentials from USB serial after firmware upload."""

from datetime import datetime
from pathlib import Path
import re
import time

try:
    Import("env")
except NameError:
    env = None


_CREDENTIALS_RE = re.compile(
    rb"\[FLOWIO_RESCUE_CREDENTIALS\]\s+ssid=([^\s]+)\s+password=([^\s]+)"
)


def _capture_from_port(upload_port, project_dir, reset_device=False):
    try:
        import serial
    except ImportError:
        print("[rescue-credentials] pyserial indisponible; fichier non créé")
        return

    upload_port = str(upload_port or "").strip()
    if not upload_port or upload_port.startswith("$"):
        print("[rescue-credentials] port série inconnu; fichier non créé")
        return

    deadline = time.monotonic() + 45.0
    serial_port = None
    match = None
    while time.monotonic() < deadline and match is None:
        if serial_port is None:
            try:
                serial_port = serial.Serial(upload_port, 115200, timeout=0.5)
                if reset_device:
                    serial_port.dtr = False
                    serial_port.rts = True
                    time.sleep(0.1)
                    serial_port.dtr = True
                    serial_port.rts = False
                    time.sleep(0.1)
                    serial_port.dtr = False
                    reset_device = False
            except (OSError, serial.SerialException):
                time.sleep(0.5)
                continue
        try:
            line = serial_port.readline()
        except (OSError, serial.SerialException):
            serial_port.close()
            serial_port = None
            time.sleep(0.5)
            continue
        match = _CREDENTIALS_RE.search(line)

    if serial_port is not None:
        serial_port.close()

    if match is None:
        print("[rescue-credentials] identifiants non reçus sur le port série")
        return

    ssid = match.group(1).decode("utf-8", errors="strict")
    password = match.group(2).decode("utf-8", errors="strict")
    output_dir = Path(project_dir) / "local-device"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "rescue-access.txt"
    temp_path = output_dir / "rescue-access.txt.tmp"
    content = (
        "Flow.io — accès au portail Rescue\n"
        f"Généré après flash : {datetime.now().astimezone().isoformat(timespec='seconds')}\n\n"
        f"Réseau Wi-Fi : {ssid}\n"
        f"Mot de passe : {password}\n"
        "Adresse : http://192.168.4.1/rescue\n\n"
        "Conserver ce fichier localement : il contient un mot de passe en clair.\n"
    )
    temp_path.write_text(content, encoding="utf-8")
    temp_path.replace(output_path)
    print(f"[rescue-credentials] accès {ssid} enregistré dans {output_path}")


def _capture_rescue_credentials(source, target, env):
    _capture_from_port(env.subst("$UPLOAD_PORT"), env.subst("$PROJECT_DIR"))


if env is not None:
    env.AddPostAction("upload", _capture_rescue_credentials)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", required=True)
    parser.add_argument("--project-dir", required=True)
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()
    _capture_from_port(args.port, args.project_dir, args.reset)
