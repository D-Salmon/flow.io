#pragma once

#include <ArduinoJson.h>

/**
 * @brief ArduinoJson allocator that prefers PSRAM and falls back to internal RAM.
 *
 * The returned allocator has static lifetime and can therefore be used by local
 * and static JsonDocument instances.
 */
ArduinoJson::Allocator* psramPreferredJsonAllocator();
