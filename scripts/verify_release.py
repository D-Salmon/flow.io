#!/usr/bin/env python3
"""Fail-fast checks for the Flow.io Waveshare 3.1 source/release kit."""

from __future__ import annotations

import gzip
import hashlib
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def waveshare_version() -> str:
    ini = (ROOT / "platformio.ini").read_text(encoding="utf-8")
    match = re.search(
        r"^waveshare_firmware_version\s*=\s*['\"]?\"?([^'\"\s]+)\"?['\"]?\s*$",
        ini,
        flags=re.MULTILINE,
    )
    if not match:
        fail("waveshare_firmware_version is missing from platformio.ini")
    return match.group(1)

def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


VERSION = waveshare_version()


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def require(label: str, needle: str, content: str) -> None:
    if needle not in content:
        fail(f"release invariant missing: {label}")


def verify_manifest() -> None:
    binary_dir = ROOT / "binary"
    manifest = json.loads((binary_dir / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("schema") != "flowio.firmware-manifest.v2":
        fail("manifest schema is not v2")

    entries = [
        entry
        for group in manifest.get("artifacts", {}).values()
        for entry in group
    ]
    if not entries:
        fail("manifest contains no artifacts")

    listed = {entry["path"] for entry in entries}
    required_artifacts = {
        f"flowios3-{VERSION}.bin",
        f"flowios3-spiffs-{VERSION}.bin",
    }
    if not required_artifacts.issubset(listed):
        fail(f"3.1 artifacts missing from manifest: {sorted(required_artifacts - listed)}")

    for entry in entries:
        path = binary_dir / entry["path"]
        if not path.is_file():
            fail(f"manifest artifact is missing: {path.name}")
        data = path.read_bytes()
        if entry.get("size") != len(data):
            fail(f"bad size in manifest for {path.name}")
        if entry.get("sha256") != hashlib.sha256(data).hexdigest():
            fail(f"bad SHA-256 in manifest for {path.name}")


def verify_gzip_assets() -> None:
    for archive in (ROOT / "data").rglob("*.gz"):
        source = archive.with_suffix("")
        if not source.is_file():
            fail(f"gzip asset has no source: {archive.relative_to(ROOT)}")
        try:
            expanded = gzip.decompress(archive.read_bytes())
        except (OSError, EOFError) as exc:
            fail(f"invalid gzip {archive.relative_to(ROOT)}: {exc}")
        if expanded != source.read_bytes():
            fail(f"stale gzip asset: {archive.relative_to(ROOT)}")


def verify_profile_and_safety_defaults() -> None:
    ini = read("platformio.ini")
    board = read("src/Board/WaveshareBoard.h")
    io_module = read("src/Modules/IOModule/IOModule.cpp")
    waveshare_io = read("src/Profiles/Waveshare/WaveshareIoAssembly.cpp")
    hmi = read("src/Modules/HMIModule/HMIModule.cpp")
    web = read("src/Modules/Network/WebInterfaceModule/WebInterfaceServer.cpp")
    web_lifecycle = read(
        "src/Modules/Network/WebInterfaceModule/WebInterfaceLifecycle.cpp"
    )
    web_headers = read("src/Modules/Network/WebInterfaceModule/WebSecurityHeaders.cpp")
    ota_verifier = read(
        "src/Modules/Network/WebInterfaceModule/OtaSignatureVerifier.cpp"
    )
    ota_key = read("include/Security/OtaPublicKey.h")
    firmware_update = read(
        "src/Modules/Network/FirmwareUpdateModule/FirmwareUpdateModule.cpp"
    )
    pool_header = read("src/Modules/PoolLogicModule/PoolLogicModule.h")
    pool_control = read("src/Modules/PoolLogicModule/PoolLogicControl.cpp")
    pool_lifecycle = read("src/Modules/PoolLogicModule/PoolLogicLifecycle.cpp")
    alarm_ids = read("include/Core/AlarmIds.h")
    alarm_module = read("src/Modules/AlarmModule/AlarmModule.cpp")
    filtration = read("src/Modules/PoolLogicModule/FiltrationWindow.cpp")

    required = (
        ("firmware version", f'waveshare_firmware_version = \'"{VERSION}"\'', ini),
        ("16 MB OTA partition map", "partitions_flowios3_ota_16mb.csv", ini),
        ("octal PSRAM", "board_build.psram_type = opi", ini),
        ("ArduinoJson 7.4.3", "bblanchon/ArduinoJson @ 7.4.3", ini),
        ("Ethernet default enabled", "kWaveshareESP32S3EthernetW5500{\n    true,", board),
        ("DS2484 build address", "FLOW_DS18_DS2484_ADDRESS=0x18u", ini),
        ("selectable DS18B20 Waveshare assembly", "useSelectableTemperatureBuses(", waveshare_io),
        ("DS2484 runtime probe", 'LOGI("DS2484 probe 0x%02X: %s"', io_module),
        ("no direct Waveshare 1-Wire table", "nullptr,\n    0,\n    kWaveshareESP32S3IoPoints", board),
        ("Web security-header middleware", "addWebSecurityHeaders(request->getResponse()", web),
        ("Web Digest authentication", "request->authenticate(webSecurity_.user", web),
        ("Web authentication throttle", "Security::checkWebAuthLimit(", web),
        ("BOOT physical recovery pin", "digitalRead(kBootRecoveryPin)", web_lifecycle),
        ("BOOT physical recovery hold", "kBootRecoveryHoldMs", web_lifecycle),
        ("physical recovery credentials route", '"/api/recovery/web-credentials"', web),
        ("Content-Security-Policy header", '"Content-Security-Policy"', web_headers),
        ("OTA ECDSA verifier", "mbedtls_pk_verify(", ota_verifier),
        ("OTA public key fail-closed default", 'PublicKeyPem[] = "";', ota_key),
        ("remote OTA sidecar signature", "fetchOtaSignature_", firmware_update),
        ("remote OTA ECDSA verification", "verifyOtaSignature(digest, signatureBase64)", firmware_update),
        ("signed SPIFFS fail-closed", "SPIFFS distant desactive en mode OTA signee", firmware_update),
        ("manual commissioning default", "bool autoMode_ = false;", pool_header),
        ("robot automation default-off", "bool robotAutoMode_ = false;", pool_header),
        ("pressure monitoring default-off", "bool pressureMonitoringEnabled_ = false;", pool_header),
        ("robot automation gate", "robotAutoMode_ && filtrationFsm_.on", pool_control),
        ("pressure safety bypass when disabled", "if (!self->pressureMonitoringEnabled_)", pool_control),
        ("robot Home Assistant switch", '"pl_robot_auto"', pool_lifecycle),
        ("pressure Home Assistant switch", '"pl_psi_monitor"', pool_lifecycle),
        ("water-temperature alarm id", "PoolWaterTemperatureUnavailable = 1009", alarm_ids),
        ("water-temperature alarm entity", "alm_water_temperature_unavailable", alarm_module),
        ("minute-precision filtration output", "uint16_t durationMinutes", filtration),
        ("off-peak filtration start", "out.startMinuteOfDay = kOffPeakStartMinute;", filtration),
        ("overnight filtration support", "stopMinuteOfDay <= startMinuteOfDay", filtration),
        ("continuous filtration support", "durationMinutes >= kMinutesPerDay", filtration),
        ("Home Assistant minute formatting", "filtr_start_minute", pool_lifecycle),
        ("Waveshare RF433 allowlist", "flowIOS3PinAllowed", hmi),
        ("Waveshare Web serial unused pins", "int uartRxPin_ = -1;", read(
            "src/Modules/Network/WebInterfaceModule/WebInterfaceModule.h"
        )),
    )
    for label, needle, content in required:
        require(label, needle, content)

    sources = "\n".join(
        path.read_text(encoding="utf-8", errors="replace")
        for root in (ROOT / "src", ROOT / "include")
        for path in root.rglob("*")
        if path.suffix in {".h", ".hpp", ".c", ".cpp"}
    )
    if re.search(r"\b(?:Static|Dynamic)JsonDocument\b", sources):
        fail("legacy ArduinoJson document type remains in source")


def verify_waveshare_only() -> None:
    environments = re.findall(r'^\[env:([^]]+)\]', read('platformio.ini'), re.MULTILINE)
    if environments != ['Waveshare-ESP32-S3']:
        fail(f'unexpected build environments: {environments}')
    removed = (
        'src/Profiles/FlowIO', 'src/Profiles/Supervisor',
        'src/Profiles/FlowConnectDisplay', 'src/Profiles/Micronova',
        'src/Modules/FlowConnectDisplay', 'src/Modules/Micronova',
        'src/Modules/SupervisorHMIModule',
        'src/Modules/Network/I2CCfgClientModule',
        'src/Modules/Network/I2CCfgServerModule',
        'src/Modules/Network/HmiUdpServerModule',
    )
    for directory in removed:
        if any(path.is_file() for path in (ROOT / directory).rglob('*')):
            fail(f'removed profile/module reintroduced: {directory}')
    obsolete = re.compile(r'\bFLOW_(?:PROFILE|BUILD_IS)_(?:FLOWIO|SUPERVISOR|FLOW_CONNECT_DISPLAY|MICRONOVA)\b')
    for root in (ROOT / 'src', ROOT / 'include'):
        for path in root.rglob('*'):
            if path.suffix in {'.h', '.hpp', '.cpp', '.c'} and obsolete.search(path.read_text(encoding='utf-8')):
                fail(f'obsolete profile conditional: {path.relative_to(ROOT)}')


def verify_declared_limits() -> None:
    status = read("docs/release-3.1.3.md")
    required = (
        "Qwiic / DS2484",
        "GPIO20",
        "GPIO19",
        "GPIO42/GPIO41",
    )
    for text in required:
        require(f"documented 3.1 limitation: {text}", text, status)


def main() -> int:
    verify_waveshare_only()
    verify_manifest()
    verify_gzip_assets()
    verify_profile_and_safety_defaults()
    verify_declared_limits()
    print("release verification: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
