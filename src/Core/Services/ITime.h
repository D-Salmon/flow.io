#pragma once
/**
 * @file ITime.h
 * @brief Generic time synchronization service interface.
 */
#include <stddef.h>
#include <stdint.h>

/** @brief Time synchronization state. */
enum class TimeSyncState : uint8_t { Disabled, WaitingNetwork, Syncing, Synced, ErrorWait };

/** @brief Selected time reference source. */
enum class TimeSource : uint8_t {
    None = 0,
    Ntp = 1,
    InternalRtc = 2,
    NextionManual = 3
};

/** @brief Backward compatibility alias. */
using NTPState = TimeSyncState;

/** @brief Service interface for time synchronization and formatting. */
struct TimeService {
    TimeSyncState (*state)(void* ctx);
    bool (*isSynced)(void* ctx);
    uint64_t (*epoch)(void* ctx);
    bool (*formatLocalTime)(void* ctx, char* out, size_t len);
    void* ctx;
    bool (*setExternalEpoch)(void* ctx, uint64_t epochSec);
    bool (*isExternalRtc)(void* ctx);
    TimeSource (*source)(void* ctx);
    const char* (*sourceName)(void* ctx);
};
