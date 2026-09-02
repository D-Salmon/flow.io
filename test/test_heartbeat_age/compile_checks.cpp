// Also executable as compile-time tests with the ESP32 cross-compiler when a
// host GCC is unavailable: -std=c++17 -fsyntax-only -Iinclude <this file>.
#include "Core/HeartbeatAge.h"
static_assert(HeartbeatAge::elapsed(100, 102) == 0, "future sample by 2ms");
static_assert(HeartbeatAge::elapsed(100, 101) == 0, "future sample by 1ms");
static_assert(HeartbeatAge::elapsed(100, 100) == 0, "current heartbeat");
static_assert(HeartbeatAge::elapsed(100, 0) == UINT32_MAX, "missing heartbeat");
static_assert(HeartbeatAge::elapsed(7000, 1000) == 6000, "real stale heartbeat");
static_assert(HeartbeatAge::elapsed(6000, 1000) == 5000, "threshold boundary");
static_assert(HeartbeatAge::elapsed(16, 0xfffffff0U) == 32, "millis wrap");
static_assert(HeartbeatAge::mostRecentAge(16, 0xfffffff0U, 8) == 8, "latest after wrap");
static_assert(HeartbeatAge::mostRecentAge(16, 8, 0xfffffff0U) == 8, "latest before wrap");
static_assert(HeartbeatAge::mostRecentAge(16, 0, 8) == 8, "one missing client timestamp");
static_assert(HeartbeatAge::mostRecentAge(16, 0, 0) == UINT32_MAX, "both missing");
