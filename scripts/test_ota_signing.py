#!/usr/bin/env python3
"""Integration test for the external Flow.io OTA signing workflow."""

from __future__ import annotations

import base64
import subprocess
import sys
import tempfile
from pathlib import Path


def run(*args: str, expect_success: bool = True) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if (result.returncode == 0) != expect_success:
        sys.stderr.buffer.write(result.stdout)
        sys.stderr.buffer.write(result.stderr)
        raise RuntimeError(f"unexpected return code {result.returncode}: {' '.join(args)}")
    return result


def main() -> int:
    repository = Path(__file__).resolve().parents[1]
    signing_script = repository / "scripts" / "sign_ota.py"

    with tempfile.TemporaryDirectory() as temp_name:
        temp = Path(temp_name)
        private_key = temp / "ota-private.pem"
        public_key = temp / "ota-public.pem"
        artifact = temp / "firmware.bin"
        signature_b64 = temp / "firmware.bin.sig"
        signature_der = temp / "firmware.bin.sig.der"

        run("openssl", "ecparam", "-name", "prime256v1", "-genkey",
            "-noout", "-out", str(private_key))
        run("openssl", "ec", "-in", str(private_key), "-pubout",
            "-out", str(public_key))

        artifact.write_bytes(b"Flow.io deterministic OTA signing test\n")
        run(sys.executable, str(signing_script), str(artifact),
            "--private-key", str(private_key), "--output", str(signature_b64))
        signature_der.write_bytes(base64.b64decode(signature_b64.read_text(encoding="ascii")))

        run("openssl", "dgst", "-sha256", "-verify", str(public_key),
            "-signature", str(signature_der), str(artifact))

        artifact.write_bytes(b"Flow.io tampered OTA signing test\n")
        run("openssl", "dgst", "-sha256", "-verify", str(public_key),
            "-signature", str(signature_der), str(artifact), expect_success=False)

    print("OTA signing workflow: valid signature accepted, tampered image rejected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
