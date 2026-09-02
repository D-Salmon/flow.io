#pragma once
#include <stdint.h>

namespace HeartbeatAge {
// Zero denotes an absent heartbeat. Unsigned subtraction handles millis wrap.
// A snapshot slightly newer than the sample is fresh, not ~49 days old.
// Heartbeat intervals must be less than half the uint32_t clock range.
constexpr uint32_t elapsed(uint32_t now, uint32_t heartbeat)
{
    if (heartbeat == 0U) return UINT32_MAX;
    const uint32_t delta = now - heartbeat;
    return delta > INT32_MAX ? 0U : delta;
}
constexpr uint32_t mostRecentAge(uint32_t now, uint32_t first, uint32_t second)
{
    const uint32_t a = elapsed(now, first);
    const uint32_t b = elapsed(now, second);
    return a < b ? a : b;
}
}
