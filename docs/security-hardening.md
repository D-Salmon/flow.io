# Security hardening

This kit layers physical recovery, Web authentication, CSRF protection and
signed firmware updates around its network attack surface.

On a blank NVS, the Ethernet-equipped Waveshare profile enables W5500 DHCP by
default so that commissioning can be performed with a wired connection. Wi-Fi
stays inactive while Ethernet is enabled. The controller must be connected only
to a trusted administration LAN.

## Web administration

On a blank NVS, Web access remains open for initial commissioning. No default or
random administrator password is generated. The installer enables protection
explicitly through the physical BOOT recovery procedure described below.

Once both an administrator user and password are stored, every operational HTTP
route and the WebSocket handshake require HTTP Digest authentication. The
credentials are never returned by configuration GET endpoints.
Submitting an empty Wi-Fi or MQTT password preserves the existing secret. Send
`clear_pass=1` only when the password must be erased.

The access-point portal exposes only captive-portal assets and Wi-Fi/MQTT
provisioning endpoints without authentication. Operational controls, diagnostics,
configuration import, reboot, reset and update routes remain protected.

## Physical access recovery

After a normal boot, hold the Waveshare `BOOT` button (`GPIO0`) for five
seconds. This opens a ten-minute recovery window on the controller's existing
Ethernet or Wi-Fi address. Do not hold BOOT while resetting or powering on the
ESP32-S3, because that selects the ROM download/flashing mode.

During the window, the embedded `/rescue` page, `/api/web/meta`, the recovery
status endpoint and the credential replacement endpoint are reachable without
the previous Digest credentials. CSRF validation remains mandatory. Firmware
update, diagnostics, reset, configuration and operational control routes remain
protected. Saving new credentials closes the window immediately and schedules
a reboot after eight seconds.

`GPIO21` must never be connected to GND for recovery: on this Waveshare profile
it drives the TFT backlight. Physical access to BOOT plus access to the trusted
administration LAN is the recovery security boundary.

Digest authentication prevents sending the password itself in clear text, but
HTTP traffic is not encrypted. Put the device on a trusted management VLAN and
do not expose port 80 to the Internet.

State-changing HTTP requests require the 128-bit per-boot token exposed as
`csrf_token` by the `/api/web/meta` response. Browser clients
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
