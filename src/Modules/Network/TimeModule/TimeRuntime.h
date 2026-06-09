#pragma once
/**
 * @file TimeRuntime.h
 * @brief Time runtime helpers and keys.
 */

#include "Core/DataStore/DataStore.h"
#include "Core/EventBus/EventPayloads.h"
#include "Core/DataKeys.h"
#include "Core/Services/ITime.h"
#include <cstdio>
#include <cstring>

// RUNTIME_PUBLIC

// Data keys for time runtime values.
constexpr DataKey DATAKEY_TIME_READY = DataKeys::TimeReady;

static inline bool timeReady(const DataStore& ds)
{
    return ds.data().time.timeReady;
}

static inline void setTimeReady(DataStore& ds, bool ready)
{
    RuntimeData& rt = ds.dataMutable();
    if (rt.time.timeReady == ready) return;
    rt.time.timeReady = ready;
    ds.notifyChanged(DATAKEY_TIME_READY);
}

static inline TimeSource timeSource(const DataStore& ds)
{
    return (TimeSource)ds.data().time.source;
}

static inline const char* timeSourceText(const DataStore& ds)
{
    return ds.data().time.sourceText;
}

static inline void setTimeSource(DataStore& ds, TimeSource source, const char* text)
{
    RuntimeData& rt = ds.dataMutable();
    const uint8_t sourceValue = (uint8_t)source;
    const char* safeText = text ? text : "none";
    if (rt.time.source == sourceValue && strncmp(rt.time.sourceText, safeText, sizeof(rt.time.sourceText)) == 0) return;
    rt.time.source = sourceValue;
    snprintf(rt.time.sourceText, sizeof(rt.time.sourceText), "%s", safeText);
    ds.notifyChanged(DATAKEY_TIME_READY);
}
