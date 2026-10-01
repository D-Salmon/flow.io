"""Compile and exercise the production startup notification coalescer."""
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class StartupDataChangesTests(unittest.TestCase):
    def test_coalescing_and_retry(self):
        with tempfile.TemporaryDirectory(prefix='flow-startup-data-') as tmp:
            binary = Path(tmp) / 'startup_data_changes'
            command = [
                'c++', '-std=c++17', '-Wall', '-Wextra', '-Werror',
                '-Itest/host/startup_stubs', '-Iinclude', '-Isrc',
                'test/host/startup_data_changes.cpp', '-o', str(binary),
            ]
            compiled = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(compiled.returncode, 0, compiled.stdout + compiled.stderr)
            ran = subprocess.run([str(binary)], cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(ran.returncode, 0, ran.stdout + ran.stderr)


if __name__ == '__main__':
    unittest.main()
