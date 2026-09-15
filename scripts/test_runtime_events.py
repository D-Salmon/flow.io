"""Exercise the production SSE event coalescer with a native compiler."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
PROGRAM = r'''
#include "Modules/Network/WebInterfaceModule/RuntimeEvents.h"
#include "Profiles/Waveshare/PoolDeviceHaCommand.h"
#include <cassert>
#include <cstring>
int main() {
    RuntimeEventState state;
    RuntimeEventBatch batch{};
    assert(state.revision() == 1U);
    state.mark(RuntimeEventDomains::Equipment);
    state.mark(RuntimeEventDomains::Alarm);
    assert(!state.take(99U, batch));
    assert(state.take(100U, batch));
    assert(batch.domains == (RuntimeEventDomains::Equipment | RuntimeEventDomains::Alarm));
    assert(batch.revision == 2U);
    state.mark(0xF0U);
    assert(!state.take(200U, batch));
    state.mark(RuntimeEventDomains::Sensors);
    assert(state.take(200U, batch));

    char payload[128]{};
    assert(formatPoolDeviceHaWritePayload(payload, sizeof(payload), 7U, true));
    assert(std::strcmp(payload,
        "{\\\"cmd\\\":\\\"poollogic.device.write\\\",\\\"args\\\":{\\\"slot\\\":7,\\\"value\\\":true}}") == 0);
    assert(formatPoolDeviceHaWritePayload(payload, sizeof(payload), 7U, false));
    assert(std::strstr(payload, "\\\"value\\\":false") != nullptr);
    char tooSmall[8]{};
    assert(!formatPoolDeviceHaWritePayload(tooSmall, sizeof(tooSmall), 7U, true));
}
'''

class RuntimeEventsTest(unittest.TestCase):
    def test_batching(self):
        compiler = shutil.which("c++") or shutil.which("g++") or shutil.which("clang++")
        if not compiler:
            self.skipTest("no native C++ compiler available")
        with tempfile.TemporaryDirectory(prefix="flow-runtime-events-") as directory:
            source = Path(directory) / "main.cpp"
            executable = Path(directory) / "test.exe"
            source.write_text(PROGRAM, encoding="utf-8")
            subprocess.run([compiler, "-std=c++17", "-Wall", "-Wextra", "-Werror",
                            "-I", str(ROOT / "src"), str(source), "-o", str(executable)], check=True)
            subprocess.run([str(executable)], check=True)

if __name__ == "__main__":
    unittest.main()
