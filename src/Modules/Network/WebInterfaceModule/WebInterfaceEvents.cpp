#include "WebInterfaceModule.h"

#include <Arduino.h>
#include <stdio.h>

void WebInterfaceModule::markRuntimeEvents_(uint8_t domains)
{
    portENTER_CRITICAL(&runtimeEventsMux_);
    runtimeEventState_.mark(domains);
    portEXIT_CRITICAL(&runtimeEventsMux_);
}

void WebInterfaceModule::configureRuntimeEvents_()
{
    runtimeEventsAvailable_ = true;
    runtimeEvents_.addMiddleware([this](AsyncWebServerRequest* request, ArMiddlewareNext next) {
        if (!runtimeEventsAvailable_ || runtimeEvents_.count() >= 4U) {
            request->send(503, "application/json",
                          "{\"ok\":false,\"err\":{\"code\":\"NotReady\",\"where\":\"runtime.events\"}}");
            return;
        }
        noteHttpActivity_();
        next();
    });
    runtimeEvents_.onConnect([this](AsyncEventSourceClient* client) {
        portENTER_CRITICAL(&runtimeEventsMux_);
        const uint32_t revision = runtimeEventState_.revision();
        portEXIT_CRITICAL(&runtimeEventsMux_);
        char message[64]{};
        snprintf(message, sizeof(message), "{\"revision\":%lu,\"domains\":%u}",
                 (unsigned long)revision, (unsigned)RuntimeEventDomains::All);
        client->send(message, "runtime", revision, 3000U);
    });
    server_.addHandler(&runtimeEvents_);
}

void WebInterfaceModule::flushRuntimeEvents_()
{
    if (!runtimeEventsAvailable_) return;
    const uint32_t nowMs = millis();
    RuntimeEventBatch batch{};
    portENTER_CRITICAL(&runtimeEventsMux_);
    const bool changed = runtimeEventState_.take(nowMs, batch);
    if (!changed) batch.revision = runtimeEventState_.revision();
    portEXIT_CRITICAL(&runtimeEventsMux_);
    if (!runtimeEvents_.count()) return;
    if (!changed && (uint32_t)(nowMs - runtimeEventsLastSendMs_) < 15000U) return;

    char message[64]{};
    snprintf(message, sizeof(message), "{\"revision\":%lu,\"domains\":%u}",
             (unsigned long)batch.revision, (unsigned)batch.domains);
    const auto status = runtimeEvents_.send(message, "runtime", batch.revision, 3000U);
    runtimeEventsLastSendMs_ = nowMs;
    if (changed && status != AsyncEventSource::ENQUEUED) {
        markRuntimeEvents_(batch.domains);
    }
}
