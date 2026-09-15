#pragma once

#include <stdint.h>

namespace RuntimeEventDomains {
constexpr uint8_t Mode = 1U;
constexpr uint8_t Equipment = 2U;
constexpr uint8_t Alarm = 4U;
constexpr uint8_t Sensors = 8U;
constexpr uint8_t All = Mode | Equipment | Alarm | Sensors;
}

struct RuntimeEventBatch {
    uint32_t revision = 0U;
    uint8_t domains = 0U;
};

/** Coalesces EventBus invalidations into bounded SSE batches. */
class RuntimeEventState {
public:
    void mark(uint8_t domains) { pending_ |= domains & RuntimeEventDomains::All; }
    uint32_t revision() const { return revision_; }

    bool take(uint32_t nowMs, RuntimeEventBatch& batch)
    {
        if (!pending_ || (uint32_t)(nowMs - lastBatchMs_) < 100U) return false;
        if (++revision_ == 0U) revision_ = 1U;
        batch = {revision_, pending_};
        pending_ = 0U;
        lastBatchMs_ = nowMs;
        return true;
    }

private:
    uint8_t pending_ = 0U;
    uint32_t revision_ = 1U;
    uint32_t lastBatchMs_ = 0U;
};
