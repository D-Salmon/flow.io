/**
 * @file ActivityLogModule.cpp
 * @brief User-facing activity journal backed by PSRAM and SPIFFS rotation.
 */

#include "ActivityLogModule.h"

#include "App/FirmwareProfile.h"
#include "Core/FirmwareVersion.h"
#include "Core/LogModuleIds.h"
#include "Core/Services/Services.h"

#define LOG_MODULE_ID ((LogModuleId)LogModuleIdValue::ActivityLogModule)
#include "Core/ModuleLog.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <FS.h>
#include <SPIFFS.h>
#include <esp_heap_caps.h>
#include <esp_system.h>
#include <string.h>
#include <stdlib.h>

namespace {
static void copyText_(char* out, size_t outLen, const char* in)
{
    if (!out || outLen == 0U) return;
    snprintf(out, outLen, "%s", in ? in : "");
}

static const char* resetReasonStr_(esp_reset_reason_t reason)
{
    switch (reason) {
        case ESP_RST_POWERON: return "poweron";
        case ESP_RST_EXT: return "external";
        case ESP_RST_SW: return "software";
        case ESP_RST_PANIC: return "panic";
        case ESP_RST_INT_WDT: return "int_wdt";
        case ESP_RST_TASK_WDT: return "task_wdt";
        case ESP_RST_WDT: return "wdt";
        case ESP_RST_DEEPSLEEP: return "deepsleep";
        case ESP_RST_BROWNOUT: return "brownout";
        case ESP_RST_SDIO: return "sdio";
        default: return "unknown";
    }
}
}  // namespace

bool ActivityLogModule::serviceEmit_(void* ctx, const ActivityEvent* event)
{
    ActivityLogModule* self = static_cast<ActivityLogModule*>(ctx);
    if (!self || !event) return false;
    return self->emit_(*event);
}

void ActivityLogModule::serviceGetStats_(void* ctx, ActivityLogStats* out)
{
    ActivityLogModule* self = static_cast<ActivityLogModule*>(ctx);
    if (!self || !out) return;
    self->getStats_(*out);
}

uint16_t ActivityLogModule::serviceReadPage_(void* ctx,
                                             uint16_t offset,
                                             uint16_t limit,
                                             ActivityLogReplayWriter writer,
                                             void* writerCtx)
{
    ActivityLogModule* self = static_cast<ActivityLogModule*>(ctx);
    if (!self) return 0;
    return self->readPage_(offset, limit, writer, writerCtx);
}

bool ActivityLogModule::serviceClear_(void* ctx)
{
    ActivityLogModule* self = static_cast<ActivityLogModule*>(ctx);
    if (!self) return false;
    return self->clear_();
}

uint32_t ActivityLogModule::serviceRemove_(void* ctx, const char* ids)
{
    auto* self = static_cast<ActivityLogModule*>(ctx);
    return self ? self->requestDelete_(ids, false) : 0;
}

void ActivityLogModule::init(ConfigStore&, ServiceRegistry& services)
{
    services_ = &services;

    const size_t bytes = (size_t)kCapacity * sizeof(ActivityEvent);
    entries_ = static_cast<ActivityEvent*>(
        heap_caps_calloc(kCapacity, sizeof(ActivityEvent), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT)
    );
    if (entries_) {
        capacity_ = kCapacity;
        inPsram_ = true;
    } else {
        static constexpr uint16_t kFallbackCapacity = 128;
        entries_ = static_cast<ActivityEvent*>(
            heap_caps_calloc(kFallbackCapacity, sizeof(ActivityEvent), MALLOC_CAP_8BIT)
        );
        if (entries_) {
            capacity_ = kFallbackCapacity;
        }
    }

    persistQueue_ = xQueueCreate(kPersistQueueLen, sizeof(ActivityEvent));
    emitMutex_ = xSemaphoreCreateMutex();

    service_.emit = &ActivityLogModule::serviceEmit_;
    service_.getStats = &ActivityLogModule::serviceGetStats_;
    service_.readPage = &ActivityLogModule::serviceReadPage_;
    service_.clear = &ActivityLogModule::serviceClear_;
    service_.remove = &ActivityLogModule::serviceRemove_;
    service_.ctx = this;

    if (!services.add(ServiceId::ActivityLog, &service_)) {
        LOGE("service registration failed: %s", toString(ServiceId::ActivityLog));
    }

    spiffsReady_ = SPIFFS.begin(false);
    if (!entries_ || capacity_ == 0U) {
        LOGW("Activity log memory unavailable");
    }
    if (!persistQueue_) {
        LOGW("Activity log persistence queue unavailable");
    }
    if (!spiffsReady_) {
        LOGW("Activity log SPIFFS persistence unavailable");
    } else {
        replayFile_(kRotatedLogPath);
        replayFile_(kLogPath);
    }

    bootEventPending_ = true;
    bootEventSinceMs_ = millis();
    LOGI("Activity log ready entries=%u psram=%u spiffs=%u",
         (unsigned)capacity_,
         inPsram_ ? 1U : 0U,
         spiffsReady_ ? 1U : 0U);
}

void ActivityLogModule::loop()
{
    processDelete_();
    emitBootEventIfReady_();

    ActivityEvent event{};
    if (persistQueue_ && xQueueReceive(persistQueue_, &event, pdMS_TO_TICKS(1000)) == pdTRUE) {
        if (!persist_(event)) {
            ++persistDropCount_;
        }
    }
}

uint32_t ActivityLogModule::epochNow_()
{
    if (!timeSvc_ && services_) {
        timeSvc_ = services_->get<TimeService>(ServiceId::Time);
    }
    if (!timeSvc_ || !timeSvc_->isSynced || !timeSvc_->epoch) return 0;
    if (!timeSvc_->isSynced(timeSvc_->ctx)) return 0;
    const uint64_t epoch = timeSvc_->epoch(timeSvc_->ctx);
    if (epoch < 1609459200ULL || epoch > 0xFFFFFFFFULL) return 0;
    return (uint32_t)epoch;
}

void ActivityLogModule::normalizeEvent_(ActivityEvent& event)
{
    if (event.ts_ms == 0U) event.ts_ms = millis();
    if (event.epoch_s == 0U) event.epoch_s = epochNow_();
    portENTER_CRITICAL(&mux_);
    if (event.seq == 0U) {
        event.seq = nextSeq_++;
    } else if (event.seq >= nextSeq_) {
        nextSeq_ = event.seq + 1U;
    }
    portEXIT_CRITICAL(&mux_);
    event.title[sizeof(event.title) - 1U] = '\0';
    event.detail[sizeof(event.detail) - 1U] = '\0';
    event.icon[sizeof(event.icon) - 1U] = '\0';
    if (event.icon[0] == '\0') {
        copyText_(event.icon, sizeof(event.icon), "history");
    }
}

bool ActivityLogModule::emit_(const ActivityEvent& in)
{
    if (!entries_ || capacity_ == 0U || !emitMutex_) return false;
    if (xSemaphoreTake(emitMutex_, pdMS_TO_TICKS(20)) != pdTRUE) return false;

    ActivityEvent event = in;
    normalizeEvent_(event);
    appendRing_(event);

    if (spiffsReady_ && persistQueue_) {
        if (xQueueSend(persistQueue_, &event, 0) != pdTRUE) {
            ++persistDropCount_;
        }
    }
    xSemaphoreGive(emitMutex_);
    return true;
}

bool ActivityLogModule::clear_()
{
    return requestDelete_(nullptr, true) != 0;
}

uint32_t ActivityLogModule::requestDelete_(const char* ids, bool all)
{
    if (!spiffsReady_ || !persistQueue_ || !emitMutex_) return 0;
    auto* job = static_cast<DeleteRequest*>(heap_caps_calloc(1, sizeof(DeleteRequest), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    if (!job) return 0;
    job->all = all;
    if (!all) {
        const char* p = ids;
        while (p && *p && job->count < kCapacity) {
            if (*p < '0' || *p > '9') break;
            char* end = nullptr;
            const unsigned long long value = strtoull(p, &end, 10);
            if (value == 0 || value > UINT32_MAX || (*end && *end != ',')) break;
            job->ids[job->count++] = static_cast<uint32_t>(value);
            p = *end ? end + 1 : end;
            if (*end && !*p) { p = nullptr; break; }
        }
        if (!p || *p || job->count == 0) { heap_caps_free(job); return 0; }
    }
    if (xSemaphoreTake(emitMutex_, pdMS_TO_TICKS(20)) != pdTRUE) { heap_caps_free(job); return 0; }
    portENTER_CRITICAL(&mux_);
    bool busy = deleteState_ == 1;
    if (!all) {
        for (uint16_t i = 0; i < job->count; ++i) {
            if (job->ids[i] >= nextSeq_) busy = true;
        }
    }
    uint32_t id = 0;
    if (!busy) {
        if (all) { job->ids[0] = nextSeq_ - 1; job->count = 1; }
        id = ++deleteId_;
        deleteState_ = 1;
        pendingDelete_ = job;
    }
    portEXIT_CRITICAL(&mux_);
    xSemaphoreGive(emitMutex_);
    if (busy) heap_caps_free(job);
    return id;
}

void ActivityLogModule::removeRing_(uint32_t seq, bool all)
{
    portENTER_CRITICAL(&mux_);
    uint16_t kept = 0;
    for (uint16_t i = 0; i < count_; ++i) {
        const uint16_t from = (head_ + i) % capacity_;
        const bool erase = all ? entries_[from].seq <= seq : entries_[from].seq == seq;
        if (!erase) {
            const uint16_t to = (head_ + kept++) % capacity_;
            if (to != from) entries_[to] = entries_[from];
        }
    }
    count_ = kept;
    portEXIT_CRITICAL(&mux_);
}

void ActivityLogModule::processDelete_()
{
    portENTER_CRITICAL(&mux_);
    DeleteRequest* job = pendingDelete_;
    pendingDelete_ = nullptr;
    portEXIT_CRITICAL(&mux_);
    if (!job) return;
    // Only this task writes SPIFFS. Flush pre-request events before tombstones.
    const UBaseType_t queued = uxQueueMessagesWaiting(persistQueue_);
    ActivityEvent event{};
    bool ok = true;
    for (UBaseType_t i = 0; i < queued; ++i) {
        if (xQueueReceive(persistQueue_, &event, 0) == pdTRUE && !persist_(event)) ++persistDropCount_;
        vTaskDelay(1);
    }
    for (uint16_t i = 0; i < job->count; ++i) {
        event = {};
        event.seq = job->ids[i];
        event.code = UINT16_MAX; // Internal tombstone; never displayed as an event.
        event.state = job->all ? 1 : 0;
        if (!persist_(event)) { ok = false; break; }
        removeRing_(event.seq, job->all);
        vTaskDelay(1);
    }
    heap_caps_free(job);
    portENTER_CRITICAL(&mux_);
    deleteState_ = ok ? 2 : 3;
    portEXIT_CRITICAL(&mux_);
}

void ActivityLogModule::appendRing_(const ActivityEvent& event)
{
    if (!entries_ || capacity_ == 0U) return;

    portENTER_CRITICAL(&mux_);
    uint16_t idx = 0;
    if (count_ < capacity_) {
        idx = (uint16_t)((head_ + count_) % capacity_);
        ++count_;
    } else {
        idx = head_;
        head_ = (uint16_t)((head_ + 1U) % capacity_);
        ++droppedCount_;
    }
    entries_[idx] = event;
    portEXIT_CRITICAL(&mux_);
}

void ActivityLogModule::getStats_(ActivityLogStats& out) const
{
    portENTER_CRITICAL(&mux_);
    out.capacity = capacity_;
    out.count = count_;
    out.droppedCount = droppedCount_;
    out.persistedCount = persistedCount_;
    out.persistDropCount = persistDropCount_;
    out.seqNext = nextSeq_;
    out.psram = inPsram_;
    out.spiffs = spiffsReady_;
    out.deleteId = deleteId_;
    out.deleteState = deleteState_;
    portEXIT_CRITICAL(&mux_);
}

uint16_t ActivityLogModule::readPage_(uint16_t offset,
                                      uint16_t limit,
                                      ActivityLogReplayWriter writer,
                                      void* writerCtx) const
{
    if (!writer || !entries_ || capacity_ == 0U || limit == 0U) return 0;

    uint16_t total = 0;
    portENTER_CRITICAL(&mux_);
    total = count_;
    portEXIT_CRITICAL(&mux_);
    if (offset >= total) return 0;

    const uint16_t available = (uint16_t)(total - offset);
    const uint16_t maxToSend = (limit < available) ? limit : available;
    uint16_t sent = 0;
    for (uint16_t i = 0; i < maxToSend; ++i) {
        ActivityEvent event{};
        portENTER_CRITICAL(&mux_);
        const uint16_t logicalIndex = (uint16_t)(offset + i);
        if (logicalIndex >= count_) { portEXIT_CRITICAL(&mux_); break; }
        const uint16_t idx = (uint16_t)((head_ + logicalIndex) % capacity_);
        event = entries_[idx];
        portEXIT_CRITICAL(&mux_);

        if (!writer(writerCtx, event, (uint16_t)(offset + i), total)) {
            break;
        }
        ++sent;
    }
    return sent;
}

bool ActivityLogModule::formatLine_(const ActivityEvent& event, char* out, size_t outLen) const
{
    if (!out || outLen == 0U) return false;
    if (event.code == UINT16_MAX) {
        const int n = snprintf(out, outLen, "{\"seq\":%lu,\"code\":65535,\"state\":%u}",
                               (unsigned long)event.seq, (unsigned)event.state);
        return n > 0 && static_cast<size_t>(n) < outLen;
    }
    out[0] = '\0';
    JsonDocument doc;
    doc["seq"] = event.seq;
    doc["ts"] = event.ts_ms;
    doc["epoch"] = event.epoch_s;
    doc["code"] = event.code;
    doc["domain"] = event.domain;
    doc["source"] = event.source;
    doc["severity"] = event.severity;
    doc["role"] = event.role;
    doc["state"] = event.state;
    doc["reason"] = event.reason;
    doc["slot"] = event.targetSlot;
    doc["title"] = event.title;
    doc["detail"] = event.detail;
    doc["icon"] = event.icon;
    const size_t wrote = serializeJson(doc, out, outLen);
    return wrote > 0U && wrote < outLen;
}

bool ActivityLogModule::parseLine_(const char* line, ActivityEvent& out) const
{
    if (!line || line[0] == '\0') return false;
    JsonDocument doc;
    if (deserializeJson(doc, line) != DeserializationError::Ok) return false;

    out = {};
    out.seq = doc["seq"] | 0U;
    out.ts_ms = doc["ts"] | 0U;
    out.epoch_s = doc["epoch"] | 0U;
    out.code = doc["code"] | 0U;
    out.domain = doc["domain"] | (uint8_t)ActivityDomain::System;
    out.source = doc["source"] | (uint8_t)ActivitySource::System;
    out.severity = doc["severity"] | (uint8_t)ActivitySeverity::Info;
    out.role = doc["role"] | (uint8_t)ActivityRole::None;
    out.state = doc["state"] | (uint8_t)ActivityState::None;
    out.reason = doc["reason"] | (uint8_t)ActivityReason::None;
    out.targetSlot = doc["slot"] | ACTIVITY_TARGET_NONE;
    copyText_(out.title, sizeof(out.title), doc["title"] | "");
    copyText_(out.detail, sizeof(out.detail), doc["detail"] | "");
    copyText_(out.icon, sizeof(out.icon), doc["icon"] | "history");
    if (out.code == UINT16_MAX) return out.state <= 1;
    if (out.seq == 0U || out.title[0] == '\0') return false;
    return true;
}

void ActivityLogModule::replayFile_(const char* path)
{
    if (!spiffsReady_ || !path || !SPIFFS.exists(path)) return;
    File file = SPIFFS.open(path, FILE_READ);
    if (!file) return;

    char line[kLineMax] = {0};
    while (file.available()) {
        const size_t n = file.readBytesUntil('\n', line, sizeof(line) - 1U);
        line[n] = '\0';
        if (n == 0U) continue;
        ActivityEvent event{};
        if (parseLine_(line, event)) {
            if (event.code == UINT16_MAX) {
                if (event.seq >= nextSeq_) nextSeq_ = event.seq + 1;
                removeRing_(event.seq, event.state == 1);
                continue;
            }
            normalizeEvent_(event);
            appendRing_(event);
        }
    }
    file.close();
}

void ActivityLogModule::rotateIfNeeded_(size_t incomingLen)
{
    if (!spiffsReady_) return;
    File file = SPIFFS.open(kLogPath, FILE_READ);
    const size_t currentSize = file ? file.size() : 0U;
    if (file) file.close();
    if (currentSize + incomingLen + 1U <= kFileMaxBytes) return;

    if (SPIFFS.exists(kRotatedLogPath)) {
        SPIFFS.remove(kRotatedLogPath);
    }
    if (SPIFFS.exists(kLogPath)) {
        SPIFFS.rename(kLogPath, kRotatedLogPath);
    }
}

bool ActivityLogModule::persist_(const ActivityEvent& event)
{
    if (!spiffsReady_) return false;
    char line[kLineMax] = {0};
    if (!formatLine_(event, line, sizeof(line))) return false;

    const size_t len = strlen(line);
    // Deletion records must not themselves evict surviving history through rotation.
    if (event.code != UINT16_MAX) rotateIfNeeded_(len);
    File file = SPIFFS.open(kLogPath, FILE_APPEND);
    if (!file) return false;
    // Separate any incomplete line left by a previous failed write/reset.
    if (event.code == UINT16_MAX && file.print('\n') != 1U) { file.close(); return false; }
    const size_t wrote = file.print(line);
    const size_t wroteNl = file.print('\n');
    file.close();
    if (wrote != len || wroteNl != 1U) return false;
    ++persistedCount_;
    return true;
}

void ActivityLogModule::emitBootEvent_()
{
    ActivityEvent event{};
    event.code = (uint16_t)ActivityCode::SystemBoot;
    event.domain = (uint8_t)ActivityDomain::System;
    event.source = (uint8_t)ActivitySource::Boot;
    event.severity = (uint8_t)ActivitySeverity::Info;
    event.reason = (uint8_t)ActivityReason::Boot;
    copyText_(event.title, sizeof(event.title), "flow.io a démarré");
    snprintf(event.detail,
             sizeof(event.detail),
             "Firmware %s, reset=%s",
             FirmwareVersion::Full,
             resetReasonStr_(esp_reset_reason()));
    copyText_(event.icon, sizeof(event.icon), "power_settings_new");
    (void)emit_(event);
}

void ActivityLogModule::emitBootEventIfReady_()
{
    if (!bootEventPending_) return;

    const uint32_t nowMs = millis();
    const bool timedOut = (uint32_t)(nowMs - bootEventSinceMs_) >= kBootEventMaxDelayMs;
    if (epochNow_() == 0U && !timedOut) return;

    emitBootEvent_();
    bootEventPending_ = false;
}
