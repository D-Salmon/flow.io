/**
 * @file ConfigStoreModule.cpp
 * @brief Implementation file.
 */
#include "ConfigStoreModule.h"
#define LOG_MODULE_ID ((LogModuleId)LogModuleIdValue::ConfigStoreModule)
#include "Core/ModuleLog.h"

#include <string.h>

namespace {
bool copyNvsKey_(char (&dst)[Limits::MaxNvsKeyLen + 1], const char* key)
{
    if (!key || key[0] == '\0') return false;
    const size_t len = strlen(key);
    if (len > Limits::MaxNvsKeyLen) return false;
    memcpy(dst, key, len + 1U);
    return true;
}
}

bool ConfigStoreModule::applyJson_(const char* json) {
    return registry ? registry->applyJson(json) : false;
}

void ConfigStoreModule::toJson_(char* out, size_t outLen) {
    if (!registry) return;
    registry->toJson(out, outLen);
}

bool ConfigStoreModule::toJsonModule_(const char* module, char* out, size_t outLen, bool* truncated) {
    return registry ? registry->toJsonModule(module, out, outLen, truncated) : false;
}

uint8_t ConfigStoreModule::listModules_(const char** out, uint8_t max) {
    return registry ? registry->listModules(out, max) : 0;
}

bool ConfigStoreModule::erase_() {
    return registry ? registry->erasePersistent() : false;
}

bool ConfigStoreModule::readRuntimeBlob_(const char* key, void* out, size_t outLen, size_t* actualLen) {
    return registry ? registry->readRuntimeBlob(key, out, outLen, actualLen) : false;
}

bool ConfigStoreModule::writeRuntimeBlob_(const char* key, const void* value, size_t len) {
    return registry ? registry->writeRuntimeBlob(key, value, len) : false;
}

bool ConfigStoreModule::eraseKey_(const char* key) {
    return registry ? registry->eraseKey(key) : false;
}

bool ConfigStoreModule::writeRuntimeBlobAsync_(const char* key, const void* value, size_t len) {
    if (!value || len == 0U || len > kPersistenceBlobMax) return false;
    PersistenceRequest req{};
    req.op = PersistenceOp::WriteBlob;
    req.len = (uint8_t)len;
    if (!copyNvsKey_(req.key, key)) return false;
    memcpy(req.bytes, value, len);
    return enqueuePersistence_(req);
}

bool ConfigStoreModule::eraseKeyAsync_(const char* key) {
    PersistenceRequest req{};
    req.op = PersistenceOp::EraseKey;
    if (!copyNvsKey_(req.key, key)) return false;
    return enqueuePersistence_(req);
}

bool ConfigStoreModule::persistFloatAsync_(const char* key,
                                           float value,
                                           const char* moduleName,
                                           uint8_t moduleId,
                                           uint8_t localBranchId) {
    PersistenceRequest req{};
    req.op = PersistenceOp::PersistFloat;
    req.floatValue = value;
    req.moduleId = moduleId;
    req.localBranchId = localBranchId;
    if (!copyNvsKey_(req.key, key)) return false;
    if (moduleName && moduleName[0] != '\0') {
        strncpy(req.moduleName, moduleName, sizeof(req.moduleName) - 1U);
        req.moduleName[sizeof(req.moduleName) - 1U] = '\0';
    }
    return enqueuePersistence_(req);
}

bool ConfigStoreModule::enqueuePersistence_(const PersistenceRequest& req) {
    if (!persistenceQ_) return false;
    const BaseType_t ok = xQueueSend(persistenceQ_, &req, 0);
    if (ok != pdTRUE) {
        LOGW("persistence queue full op=%u key=%s", (unsigned)req.op, req.key);
        return false;
    }
    return true;
}

void ConfigStoreModule::processPersistence_(const PersistenceRequest& req) {
    if (!registry) return;

    bool ok = false;
    switch (req.op) {
        case PersistenceOp::WriteBlob:
            ok = registry->writeRuntimeBlob(req.key, req.bytes, req.len);
            break;
        case PersistenceOp::EraseKey:
            ok = registry->eraseKey(req.key);
            break;
        case PersistenceOp::PersistFloat:
            ok = registry->persistFloatValue(req.key, req.floatValue);
            if (ok) {
                registry->notifyStoredValueChanged(req.key,
                                                   req.moduleName,
                                                   req.moduleId,
                                                   req.localBranchId);
            }
            break;
    }

    if (!ok) {
        LOGW("persistence op failed op=%u key=%s", (unsigned)req.op, req.key);
    }
}

void ConfigStoreModule::init(ConfigStore& cfg, ServiceRegistry& services) {
    registry = &cfg;
    if (!persistenceQ_) {
        persistenceQ_ = xQueueCreateStatic(kPersistenceQueueLen,
                                           sizeof(PersistenceRequest),
                                           persistenceQStorage_,
                                           &persistenceQStatic_);
    }

    /// récupérer service loghub (log async)
    logHub = services.get<LogHubService>(ServiceId::LogHub);

    if (!services.add(ServiceId::ConfigStore, &svc_)) {
        LOGE("service registration failed: %s", toString(ServiceId::ConfigStore));
    }
    LOGI("ConfigStoreService registered");
}

void ConfigStoreModule::loop() {
    if (!persistenceQ_) {
        vTaskDelay(pdMS_TO_TICKS(1000));
        return;
    }

    PersistenceRequest req{};
    if (xQueueReceive(persistenceQ_, &req, portMAX_DELAY) == pdTRUE) {
        processPersistence_(req);
    }
}
