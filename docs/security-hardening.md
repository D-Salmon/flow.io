# Security hardening

This kit uses fail-closed defaults for its network attack surface.

On a blank NVS, the Ethernet-equipped Waveshare profile enables W5500 DHCP by
default so that commissioning can be performed with a wired connection. Web
Digest authentication remains mandatory, and the controller must be connected
only to a trusted administration LAN. Wi-Fi stays inactive while Ethernet is
enabled. If DHCP is unavailable, physical recovery remains the local fallback.

## Web administration

Outside access-point provisioning mode, every HTTP route and the WebSocket
handshake require HTTP Digest authentication. During first boot, the firmware
uses `FLOW_WEB_ADMIN_USER` (default: `admin`) and either:

- the build-time `FLOW_WEB_ADMIN_PASSWORD`, when non-empty; or
- a random 24-character password generated once and persisted in NVS.

The generated password is printed once to the physical serial console. The
random provisioning access-point password is also printed when that portal is
started. This is an intentional physical-access recovery channel: anyone with
access to the USB/UART console at those moments can obtain the credentials.
Production installations must keep the controller in a controlled enclosure,
restrict access to its debug connector and capture credentials only during the
commissioning procedure. Wi-Fi, MQTT and web passwords are never returned by
configuration GET endpoints.
Submitting an empty Wi-Fi or MQTT password preserves the existing secret. Send
`clear_pass=1` only when the password must be erased.

The access-point portal exposes only captive-portal assets and Wi-Fi/MQTT
provisioning endpoints without authentication. Operational controls, diagnostics,
configuration import, reboot, reset and update routes remain protected.
Its WPA2 password comes from `FLOW_PROVISIONING_AP_PASSWORD`, or is generated
randomly at boot and printed to the physical serial console when that build-time
value is empty. The former shared `flowio1234` password is no longer used.

## Physical access recovery

The Waveshare profile reserves `GPIO21` for physical recovery. Holding it to
`GND` continuously for 500 ms during boot starts the open
`FlowIO-RECOVERY-xxxxxx` access point for ten minutes. The embedded rescue page
at `http://192.168.4.1/rescue` can then replace the Web administrator
credentials and, when needed, update Wi-Fi or MQTT settings.

Recovery does not expose firmware update, diagnostics, reset or operational
control routes. All pool-device outputs are held off and ON requests are
rejected for the duration of the window. The jumper must be removed before the
scheduled reboot; leaving it fitted requests a new recovery window on every
boot.

The recovery AP is intentionally open. Its security boundary is physical access
to the controller plus the short boot-time and ten-minute windows, not a shared
fallback password. Do not leave the jumper installed, and keep the enclosure
physically controlled.

Digest authentication prevents sending the password itself in clear text, but
HTTP traffic is not encrypted. Put the device on a trusted management VLAN and
do not expose port 80 to the Internet.

State-changing HTTP requests require the 128-bit per-boot token exposed as
`csrf_token` by the authenticated `/api/web/meta` response. Browser clients
send it in `X-Flow-CSRF`; requests with a cross-site `Origin` or
`Sec-Fetch-Site` are rejected. The `/wslog` handshake requires an `Origin`
matching the request `Host`. Command-line clients must first read
`/api/web/meta`, then include `X-Flow-CSRF` on `POST`, `PUT`, `PATCH` and
`DELETE` requests.

All HTTP responses include clickjacking, MIME-sniffing, referrer, permissions
and cross-origin resource headers. Application routes use a strict CSP with
`script-src 'self'`. Only `/rescue`, `/webinterface/rescue` and `/webserial`
receive the inline-compatible CSP required by their embedded emergency pages.
The rescue page intentionally remains in program flash so that physical
recovery still works when SPIFFS is missing or corrupt.

## Firmware updates

`FLOW_ALLOW_UNSIGNED_UPDATES` defaults to `0`. Waveshare firmware jobs then
require a sidecar `<artifact>.sig`, SHA-256 streaming and a valid ECDSA P-256
signature before the inactive OTA partition is activated. A missing production
public key, missing signature or invalid signature fails closed.

For development only, a local build may opt in with:

```ini
-D FLOW_ALLOW_UNSIGNED_UPDATES=1
```

Remote Nextion and SPIFFS jobs remain rejected in signed mode because their
current streaming writers cannot guarantee validation before modifying the
target. Production hardening still needs HTTPS certificate validation,
ESP32-S3 Secure Boot v2, flash encryption and anti-rollback.

Three invalid ECDSA signatures within ten minutes raise the latched
`AlarmId 1200`. It is published through MQTT Discovery as
`binary_sensor.fio_alm_ota_signature_failures` with the default entity prefix.
The alarm condition clears ten minutes after the last invalid signature and can
then be acknowledged. A missing production public key or a missing mandatory
signature still fails closed, but is treated as a deployment/configuration
error rather than an attack counter.

## MQTT

MQTT uses `mqtts://`, the ESP certificate bundle and port 8883 by default.
Explicit `mqtt://` configuration is rejected while `FLOW_MQTT_REQUIRE_TLS=1`.
When `FLOW_MQTT_REQUIRE_AUTH=1` (the release default), the firmware also refuses
to connect if either the MQTT username or password is empty.

Inbound MQTT traffic is limited to 12 accepted messages per 10-second window.
The next message starts a 60-second block. Rejections are counted in the MQTT RX
drop metrics and logged without payloads or secrets; repeated block reports are
spaced by five seconds.

MQTT commands that start an update (`fw.update.*`, except the read-only
`fw.update.status`) are denied. Defensive aliases for full configuration import
or restore are denied as well. `cfg/set`, Home Assistant controls, reboot and
factory-reset commands remain available by explicit product choice.

Broker-side controls are still required: a unique account per Flow.io device,
anonymous access disabled and ACLs restricted to that device's topic tree and
its own Home Assistant discovery node. See
[mqtt-hardening.md](mqtt-hardening.md).

The optional remote-display HMI UDP transport has been removed. The firmware
does not open UDP port 42110; the local Nextion remains connected over UART.
