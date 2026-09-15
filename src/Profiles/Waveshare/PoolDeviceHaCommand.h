#pragma once

#include <stddef.h>
#include <stdint.h>
#include <stdio.h>

/** Build the escaped command payload embedded in Home Assistant discovery. */
inline bool formatPoolDeviceHaWritePayload(char* out, size_t capacity, uint8_t slot, bool on)
{
    if (!out || !capacity) return false;
    const int written = snprintf(
        out, capacity,
        "{\\\"cmd\\\":\\\"poollogic.device.write\\\",\\\"args\\\":{\\\"slot\\\":%u,\\\"value\\\":%s}}",
        (unsigned)slot, on ? "true" : "false");
    return written > 0 && (size_t)written < capacity;
}
