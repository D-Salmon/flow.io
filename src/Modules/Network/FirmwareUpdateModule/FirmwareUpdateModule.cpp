/**
 * @file FirmwareUpdateModule.cpp
 * @brief Firmware updater implementation.
 */

#include "FirmwareUpdateModule.h"

#include <Arduino.h>
#include <ArduinoJson.h>
#include <SPIFFS.h>
#include <FS.h>
#include <HTTPClient.h>
#include <Update.h>
#include <string.h>
#include <esp_ota_ops.h>
#include <esp_partition.h>
#include <esp_system.h>
#include <mbedtls/sha256.h>

#include "App/BuildFlags.h"
#include "Board/BoardSpec.h"
#include "Core/ErrorCodes.h"
#include "Core/FirmwareVersion.h"
#include "Core/PsramJsonAllocator.h"
#include "Core/Security/WebSecurityPolicy.h"
#include "Core/SystemLimits.h"
#include "Modules/Network/WebInterfaceModule/OtaSignatureVerifier.h"
#include "Modules/HMIModule/Drivers/NextionDisplayIdentity.h"
#include "Security/OtaPublicKey.h"

#include <ESPNexUpload.h>

#define LOG_MODULE_ID ((LogModuleId)LogModuleIdValue::FirmwareUpdateModule)
#include "Core/ModuleLog.h"

#ifndef FLOW_ALLOW_UNSIGNED_UPDATES
#define FLOW_ALLOW_UNSIGNED_UPDATES 0
#endif

namespace {

const SupervisorBoardSpec& supervisorBoardSpec_(const BoardSpec& board)
{
    // Safety fallback used only when the selected BoardSpec does not expose
    // a supervisor extension block (board.supervisor == nullptr).
    static constexpr SupervisorBoardSpec kFallback{
        {
            240,
            320,
            1,
            0,
            0,
            14,
            15,
            4,
            5,
            35,
            18,
            19,
            false,
            true,
            8000000U,
            80
        },
        {
            36,
            120,
            true,
            23,
            40
        },
        {
            25,
            26,
            13,
            115200U
        }
    };
    const SupervisorBoardSpec* cfg = boardSupervisorConfig(board);
    return cfg ? *cfg : kFallback;
}

const UartSpec& panelUartSpec_(const BoardSpec& board)
{
    static constexpr UartSpec kFallback{"panel", 2, 33, 32, 115200, false, -1};
    const UartSpec* spec = boardFindUart(board, "panel");
    if (!spec) spec = boardFindUart(board, "hmi");
    return spec ? *spec : kFallback;
}

bool extractUrlFilename_(const char* url, char* out, size_t outLen)
{
    if (!url || !out || outLen == 0U) return false;
    const char* start = strrchr(url, '/');
    start = start ? start + 1 : url;
    const char* end = start;
    while (*end && *end != '?' && *end != '#') ++end;
    const size_t len = (size_t)(end - start);
    if (len == 0U || len >= outLen) return false;
    memcpy(out, start, len);
    out[len] = '\0';
    return true;
}

}  // namespace

FirmwareUpdateModule::FirmwareUpdateModule(const BoardSpec& board)
{
    localReleaseMutex_ = xSemaphoreCreateMutex();
    const SupervisorBoardSpec& boardCfg = supervisorBoardSpec_(board);
    const UartSpec& panelUart = panelUartSpec_(board);
    flowIoEnablePin_ = boardCfg.update.flowIoEnablePin;
    nextionRxPin_ = panelUart.rxPin;
    nextionTxPin_ = panelUart.txPin;
    nextionRebootPin_ = boardCfg.update.nextionRebootPin;
    nextionUploadBaud_ = boardCfg.update.nextionUploadBaud;
}

static bool writeSimpleError_(char* out, size_t outLen, const char* msg)
{
    if (!out || outLen == 0) return false;
    if (!msg) msg = "failed";
    const int n = snprintf(out, outLen, "%s", msg);
    return n > 0 && (size_t)n < outLen;
}

static bool parseReqJsonObject_(const char* json, JsonDocument& doc)
{
    if (!json || json[0] == '\0') return false;
    const auto err = deserializeJson(doc, json);
    return !err && doc.is<JsonObjectConst>();
}

namespace {
class SemaphoreGuard {
public:
    explicit SemaphoreGuard(SemaphoreHandle_t semaphore, TickType_t waitTicks = portMAX_DELAY)
        : semaphore_(semaphore), acquired_(semaphore && xSemaphoreTake(semaphore, waitTicks) == pdTRUE) {}
    ~SemaphoreGuard() { if (acquired_) xSemaphoreGive(semaphore_); }
    bool acquired() const { return acquired_; }
private:
    SemaphoreHandle_t semaphore_ = nullptr;
    bool acquired_ = false;
};

bool parseSha256_(const char* text, uint8_t out[32])
{
    if (!text || !out || strlen(text) != 64U) return false;
    const auto nibble = [](char value) -> int {
        if (value >= '0' && value <= '9') return value - '0';
        if (value >= 'a' && value <= 'f') return value - 'a' + 10;
        if (value >= 'A' && value <= 'F') return value - 'A' + 10;
        return -1;
    };
    for (size_t i = 0U; i < 32U; ++i) {
        const int high = nibble(text[i * 2U]);
        const int low = nibble(text[i * 2U + 1U]);
        if (high < 0 || low < 0) return false;
        out[i] = (uint8_t)((high << 4) | low);
    }
    return true;
}

bool sha256Matches_(const uint8_t actual[32], const uint8_t expected[32])
{
    uint8_t difference = 0U;
    for (size_t i = 0U; i < 32U; ++i) difference |= actual[i] ^ expected[i];
    return difference == 0U;
}

bool isLocalReleaseImageTarget_(FirmwareUpdateTarget target)
{
    return target == FirmwareUpdateTarget::Spiffs || target == FirmwareUpdateTarget::Waveshare;
}

bool candidateFilesystemIsValid_(const char* label, const char* version)
{
    if (!label || label[0] == '\0') return false;
    fs::SPIFFSFS candidate;
    if (!candidate.begin(false, "/candidate", 4, label)) return false;
    const bool valid = ReleaseStorage::validateReleaseFilesystem(candidate, version, "WaveshareESP32S3");
    candidate.end();
    return valid;
}
}  // namespace

static void sanitizeJsonString_(char* s)
{
    if (!s) return;
    for (size_t i = 0; s[i] != '\0'; ++i) {
        if (s[i] == '"' || s[i] == '\\' || s[i] == '\n' || s[i] == '\r' || s[i] == '\t') {
            s[i] = ' ';
        }
    }
}

static bool fileContainsToken_(fs::FS& fs, const char* path, const char* token)
{
    if (!path || !token || token[0] == '\0') return false;
    File f = fs.open(path, FILE_READ);
    if (!f) return false;

    const size_t tokLen = strlen(token);
    size_t match = 0;
    while (f.available()) {
        const int ch = f.read();
        if (ch < 0) break;
        if ((char)ch == token[match]) {
            ++match;
            if (match == tokLen) {
                f.close();
                return true;
            }
            continue;
        }
        match = ((char)ch == token[0]) ? 1U : 0U;
    }
    f.close();
    return false;
}

static bool validateCfgDocsFile_(fs::FS& fs, const char* path, char* errOut, size_t errOutLen)
{
    if (!path) {
        writeSimpleError_(errOut, errOutLen, "cfgdocs path null");
        return false;
    }
    File f = fs.open(path, FILE_READ);
    if (!f) {
        writeSimpleError_(errOut, errOutLen, "cfgdocs open failed");
        return false;
    }
    const size_t size = (size_t)f.size();
    f.close();
    if (size < 16U) {
        writeSimpleError_(errOut, errOutLen, "cfgdocs too small");
        return false;
    }
    if (!fileContainsToken_(fs, path, "\"docs\"")) {
        writeSimpleError_(errOut, errOutLen, "cfgdocs missing docs");
        return false;
    }
    return true;
}

static void configureDownloadHttp_(HTTPClient& http)
{
    http.setReuse(false);
    http.setConnectTimeout(Limits::FirmwareUpdate::Http::ConnectTimeoutMs);
    http.setTimeout(Limits::FirmwareUpdate::Http::RequestTimeoutMs);
}

static bool writeHttpBeginFailedError_(const char* resourceLabel,
                                       const char* url,
                                       char* errOut,
                                       size_t errOutLen);
static bool writeHttpCodeFailedError_(const char* resourceLabel,
                                      const char* url,
                                      HTTPClient& http,
                                      int code,
                                      char* errOut,
                                      size_t errOutLen);

static bool fetchOtaSignature_(const char* artifactUrl,
                               char* signatureOut,
                               size_t signatureOutLen,
                               char* errOut,
                               size_t errOutLen)
{
    if (!artifactUrl || !signatureOut || signatureOutLen == 0U) {
        return writeSimpleError_(errOut, errOutLen, "invalid OTA signature request");
    }
    signatureOut[0] = '\0';

    const bool unsignedAllowed = FLOW_ALLOW_UNSIGNED_UPDATES != 0;
    if (!unsignedAllowed && OtaTrust::PublicKeyPem[0] == '\0') {
        return writeSimpleError_(errOut, errOutLen, "Cle publique OTA non provisionnee");
    }

    char signatureUrl[224] = {0};
    const int urlLen = snprintf(signatureUrl, sizeof(signatureUrl), "%s.sig", artifactUrl);
    if (urlLen <= 0 || (size_t)urlLen >= sizeof(signatureUrl)) {
        return writeSimpleError_(errOut, errOutLen, "signature URL too long");
    }

    HTTPClient http;
    configureDownloadHttp_(http);
    bool signaturePresent = false;
    if (http.begin(signatureUrl)) {
        const int code = http.GET();
        if (code == HTTP_CODE_OK) {
            String payload = http.getString();
            payload.trim();
            if (payload.length() > 0U && payload.length() < signatureOutLen) {
                snprintf(signatureOut, signatureOutLen, "%s", payload.c_str());
                signaturePresent = true;
            } else if (payload.length() >= signatureOutLen) {
                http.end();
                return writeSimpleError_(errOut, errOutLen, "Signature OTA trop longue");
            }
        } else if (!unsignedAllowed && code != 404) {
            writeHttpCodeFailedError_("signature OTA", signatureUrl, http, code, errOut, errOutLen);
            http.end();
            return false;
        }
        http.end();
    } else if (!unsignedAllowed) {
        return writeHttpBeginFailedError_("signature OTA", signatureUrl, errOut, errOutLen);
    }

    const Security::OtaUploadPreflight preflight =
        Security::evaluateOtaUploadPreflight(unsignedAllowed,
                                             OtaTrust::PublicKeyPem[0] != '\0',
                                             signaturePresent);
    if (preflight == Security::OtaUploadPreflight::PublicKeyMissing) {
        return writeSimpleError_(errOut, errOutLen, "Cle publique OTA non provisionnee");
    }
    if (preflight == Security::OtaUploadPreflight::SignatureMissing) {
        return writeSimpleError_(errOut, errOutLen, "Signature OTA manquante");
    }
    return true;
}

static bool writeHttpBeginFailedError_(const char* resourceLabel,
                                       const char* url,
                                       char* errOut,
                                       size_t errOutLen)
{
    const char* resource = (resourceLabel && resourceLabel[0] != '\0') ? resourceLabel : "ressource";
    LOGE("HTTP begin failed resource=%s url=%s", resource, url ? url : "-");
    return writeSimpleError_(errOut, errOutLen, "serveur HTTP injoignable");
}

static bool writeHttpCodeFailedError_(const char* resourceLabel,
                                      const char* url,
                                      HTTPClient& http,
                                      int code,
                                      char* errOut,
                                      size_t errOutLen)
{
    const char* resource = (resourceLabel && resourceLabel[0] != '\0') ? resourceLabel : "fichier";
    const String raw = http.errorToString(code);
    const char* rawErr = raw.c_str();
    char msg[96] = {0};

    if (code == 404) {
        snprintf(msg, sizeof(msg), "%s introuvable (404)", resource);
    } else if (code < 0) {
        snprintf(msg, sizeof(msg), "serveur HTTP injoignable");
    } else {
        snprintf(msg, sizeof(msg), "erreur HTTP %d", code);
    }

    LOGE("HTTP request failed resource=%s code=%d err=%s url=%s", resource, code, rawErr, url ? url : "-");
    return writeSimpleError_(errOut, errOutLen, msg);
}

static bool appendUrlSegment_(char* out, size_t outLen, const char* segment)
{
    if (!out || outLen == 0) return false;
    if (!segment || segment[0] == '\0') return true;

    while (*segment == '/') ++segment;
    if (*segment == '\0') return true;

    const size_t len = strlen(out);
    if (len >= outLen) return false;
    const bool needSlash = len > 0 && out[len - 1] != '/';
    const int n = snprintf(out + len, outLen - len, "%s%s", needSlash ? "/" : "", segment);
    return n >= 0 && (size_t)n < (outLen - len);
}

const char* FirmwareUpdateModule::stateStr_(UpdateState s)
{
    switch (s) {
        case UpdateState::Idle: return "idle";
        case UpdateState::Queued: return "queued";
        case UpdateState::Downloading: return "downloading";
        case UpdateState::Flashing: return "flashing";
        case UpdateState::Rebooting: return "rebooting";
        case UpdateState::Done: return "done";
        case UpdateState::Error: return "error";
        default: return "unknown";
    }
}

const char* FirmwareUpdateModule::targetStr_(FirmwareUpdateTarget t)
{
    switch (t) {
        case FirmwareUpdateTarget::Nextion: return "nextion";
        case FirmwareUpdateTarget::Waveshare: return "waveshare";
        case FirmwareUpdateTarget::Spiffs: return "spiffs";
        default: return "unknown";
    }
}

void FirmwareUpdateModule::setStatus_(UpdateState state, FirmwareUpdateTarget target,
                                      uint8_t progress, const char* msg, uint32_t operationId)
{
    portENTER_CRITICAL(&lock_);
    status_.state = state;
    status_.operationId = operationId;
    status_.target = target;
    status_.progress = progress;
    status_.updatedAtMs = millis();
    if (!msg) msg = "";
    snprintf(status_.msg, sizeof(status_.msg), "%s", msg);
    portEXIT_CRITICAL(&lock_);

    const bool otaActive = state == UpdateState::Queued ||
                           state == UpdateState::Downloading ||
                           state == UpdateState::Flashing ||
                           state == UpdateState::Rebooting;
    setHmiOtaCondition_(otaActive);
}

void FirmwareUpdateModule::setError_(FirmwareUpdateTarget target, const char* msg, uint32_t operationId)
{
    setStatus_(UpdateState::Error, target, 0, msg ? msg : "failed", operationId);
}

bool FirmwareUpdateModule::loadReceipt_()
{
    if (!cfgStore_) return false;
    FirmwareUpdateReceipt receipt{};
    size_t actualLen = 0U;
    if (!cfgStore_->readRuntimeBlob(NvsKeys::FirmwareUpdate::Receipt,
                                    &receipt, sizeof(receipt), &actualLen)) {
        if (actualLen != 0U) (void)cfgStore_->eraseKey(NvsKeys::FirmwareUpdate::Receipt);
        return false;
    }
    if (actualLen != sizeof(receipt) || !firmwareUpdateReceiptIsValid(receipt)) {
        LOGW("Invalid update receipt; removing it");
        (void)cfgStore_->eraseKey(NvsKeys::FirmwareUpdate::Receipt);
        return false;
    }
    if (finalizeFirmwareUpdateReceiptAfterBoot(&receipt) &&
        !cfgStore_->writeRuntimeBlob(NvsKeys::FirmwareUpdate::Receipt,
                                     &receipt, sizeof(receipt))) {
        LOGE("Failed to finalize update receipt after boot operation_id=%lu",
             (unsigned long)receipt.operationId);
    }
    portENTER_CRITICAL(&lock_);
    lastReceipt_ = receipt;
    hasLastReceipt_ = true;
    portEXIT_CRITICAL(&lock_);
    return true;
}

bool FirmwareUpdateModule::persistReceipt_(FirmwareUpdateTarget target,
                                           uint32_t operationId,
                                           FirmwareUpdateReceiptState state)
{
    if (!cfgStore_ || operationId == 0U) return false;
    const FirmwareUpdateReceipt receipt = makeFirmwareUpdateReceipt(target, operationId, state);
    if (!cfgStore_->writeRuntimeBlob(NvsKeys::FirmwareUpdate::Receipt,
                                     &receipt, sizeof(receipt))) {
        LOGE("Failed to persist update receipt operation_id=%lu state=%s",
             (unsigned long)operationId, firmwareUpdateReceiptStateName(state));
        return false;
    }
    portENTER_CRITICAL(&lock_);
    lastReceipt_ = receipt;
    hasLastReceipt_ = true;
    portEXIT_CRITICAL(&lock_);
    return true;
}

void FirmwareUpdateModule::setHmiOtaCondition_(bool active)
{
    if (hmiOtaActive_ == active) return;
    if (!hmiSvc_ && services_) {
        hmiSvc_ = services_->get<HmiService>(ServiceId::Hmi);
    }
    if (hmiSvc_ && hmiSvc_->setLedCondition) {
        (void)hmiSvc_->setLedCondition(hmiSvc_->ctx, HmiLedCondition::OtaInProgress, active);
    }
    hmiOtaActive_ = active;
}

void FirmwareUpdateModule::onProgressChunk_(uint32_t chunkBytes)
{
    portENTER_CRITICAL(&lock_);
    if (activeTotalBytes_ == 0) {
        portEXIT_CRITICAL(&lock_);
        return;
    }
    uint32_t next = activeSentBytes_ + chunkBytes;
    if (next > activeTotalBytes_) next = activeTotalBytes_;
    activeSentBytes_ = next;
    status_.progress = (uint8_t)((activeSentBytes_ * 100U) / activeTotalBytes_);
    status_.updatedAtMs = millis();
    portEXIT_CRITICAL(&lock_);
}

void FirmwareUpdateModule::attachWebInterfaceSvcIfNeeded_()
{
    if (webInterfaceSvc_ || !services_) return;
    webInterfaceSvc_ = services_->get<WebInterfaceService>(ServiceId::WebInterface);
}

void FirmwareUpdateModule::attachFlowCfgSvcIfNeeded_()
{
    if (flowCfgSvc_ || !services_) return;
    flowCfgSvc_ = services_->get<FlowCfgRemoteService>(ServiceId::FlowCfg);
}

bool FirmwareUpdateModule::setFlowCfgPaused_(bool paused)
{
    attachFlowCfgSvcIfNeeded_();
    if (!flowCfgSvc_ || !flowCfgSvc_->setPaused) return false;
    return flowCfgSvc_->setPaused(flowCfgSvc_->ctx, paused);
}

bool FirmwareUpdateModule::resolveUrl_(FirmwareUpdateTarget target,
                                       const char* explicitUrl,
                                       char* out,
                                       size_t outLen,
                                       char* errOut,
                                       size_t errOutLen) const
{
    if (!out || outLen == 0) return false;
    out[0] = '\0';

    if (explicitUrl && explicitUrl[0] != '\0') {
        const int n = snprintf(out, outLen, "%s", explicitUrl);
        if (n <= 0 || (size_t)n >= outLen) {
            writeSimpleError_(errOut, errOutLen, "url too long");
            return false;
        }
        return true;
    }

    (void)target;
    writeSimpleError_(errOut, errOutLen, "url required");
    return false;
}

bool FirmwareUpdateModule::resolveUpdateUrl_(const char* path,
                                             char* out,
                                             size_t outLen,
                                             char* errOut,
                                             size_t errOutLen) const
{
    if (!out || outLen == 0) return false;
    out[0] = '\0';

    if (cfgData_.updateHost[0] == '\0') {
        writeSimpleError_(errOut, errOutLen, "update_host empty");
        return false;
    }
    if (!path || path[0] == '\0') {
        writeSimpleError_(errOut, errOutLen, "path empty");
        return false;
    }

    const bool hasProto =
        (strncmp(cfgData_.updateHost, "http://", 7) == 0) || (strncmp(cfgData_.updateHost, "https://", 8) == 0);
    const int n = hasProto
                      ? snprintf(out, outLen, "%s", cfgData_.updateHost)
                      : snprintf(out, outLen, "http://%s", cfgData_.updateHost);
    if (n <= 0 || (size_t)n >= outLen ||
        !appendUrlSegment_(out, outLen, cfgData_.updatePath) ||
        !appendUrlSegment_(out, outLen, path)) {
        writeSimpleError_(errOut, errOutLen, "resolved url too long");
        return false;
    }
    return true;
}

bool FirmwareUpdateModule::parseUrlArg_(const CommandRequest& req, char* out, size_t outLen) const
{
    if (!out || outLen == 0) return false;
    out[0] = '\0';

    JsonDocument doc;
    if (parseReqJsonObject_(req.args, doc)) {
        const char* url = doc["url"] | nullptr;
        if (url && url[0] != '\0') {
            snprintf(out, outLen, "%s", url);
            return true;
        }
    }

    doc.clear();
    if (parseReqJsonObject_(req.json, doc)) {
        const char* rootUrl = doc["url"] | nullptr;
        if (rootUrl && rootUrl[0] != '\0') {
            snprintf(out, outLen, "%s", rootUrl);
            return true;
        }
        JsonVariantConst args = doc["args"];
        if (args.is<JsonObjectConst>()) {
            const char* nestedUrl = args["url"] | nullptr;
            if (nestedUrl && nestedUrl[0] != '\0') {
                snprintf(out, outLen, "%s", nestedUrl);
                return true;
            }
        }
    }

    return false;
}

bool FirmwareUpdateModule::statusJson_(char* out, size_t outLen)
{
    if (!out || outLen == 0) return false;

    UpdateStatus snap{};
    bool busy = false;
    bool pending = false;
    bool hasLastReceipt = false;
    FirmwareUpdateReceipt lastReceipt{};
    portENTER_CRITICAL(&lock_);
    snap = status_;
    busy = busy_ || localReleaseActive_;
    pending = queuedJob_.pending;
    hasLastReceipt = hasLastReceipt_;
    lastReceipt = lastReceipt_;
    portEXIT_CRITICAL(&lock_);

    sanitizeJsonString_(snap.msg);

    int n = 0;
    if (hasLastReceipt) {
        n = snprintf(out, outLen,
                     "{\"ok\":true,\"boot_id\":%lu,\"operation_id\":%lu,"
                     "\"state\":\"%s\",\"target\":\"%s\",\"busy\":%s,"
                     "\"pending\":%s,\"progress\":%u,\"ts_ms\":%lu,\"msg\":\"%s\","
                     "\"last_operation\":{\"operation_id\":%lu,\"target\":\"%s\",\"result\":\"%s\"}}",
                     (unsigned long)bootId_,
                     (unsigned long)snap.operationId,
                     stateStr_(snap.state),
                     targetStr_(snap.target),
                     busy ? "true" : "false",
                     pending ? "true" : "false",
                     (unsigned)snap.progress,
                     (unsigned long)snap.updatedAtMs,
                     snap.msg,
                     (unsigned long)lastReceipt.operationId,
                     targetStr_(lastReceipt.target),
                     firmwareUpdateReceiptStateName(lastReceipt.state));
    } else {
        n = snprintf(out, outLen,
                     "{\"ok\":true,\"boot_id\":%lu,\"operation_id\":%lu,"
                     "\"state\":\"%s\",\"target\":\"%s\",\"busy\":%s,"
                     "\"pending\":%s,\"progress\":%u,\"ts_ms\":%lu,\"msg\":\"%s\","
                     "\"last_operation\":null}",
                     (unsigned long)bootId_,
                     (unsigned long)snap.operationId,
                     stateStr_(snap.state),
                     targetStr_(snap.target),
                     busy ? "true" : "false",
                     pending ? "true" : "false",
                     (unsigned)snap.progress,
                     (unsigned long)snap.updatedAtMs,
                     snap.msg);
    }
    return n > 0 && (size_t)n < outLen;
}

bool FirmwareUpdateModule::isBusy_()
{
    bool busy = false;
    bool pending = false;
    bool nextionReboot = false;
    bool startPending = false;
    portENTER_CRITICAL(&lock_);
    busy = busy_ || localReleaseActive_;
    pending = queuedJob_.pending;
    nextionReboot = nextionRebootQueued_;
    startPending = updateStartPending_;
    portEXIT_CRITICAL(&lock_);
    return busy || pending || nextionReboot || startPending;
}

bool FirmwareUpdateModule::configJson_(char* out, size_t outLen) const
{
    if (!out || outLen == 0) return false;

    char host[sizeof(cfgData_.updateHost)] = {0};
    char updatePath[sizeof(cfgData_.updatePath)] = {0};
    snprintf(host, sizeof(host), "%s", cfgData_.updateHost);
    snprintf(updatePath, sizeof(updatePath), "%s", cfgData_.updatePath);
    sanitizeJsonString_(host);
    sanitizeJsonString_(updatePath);

    const int n = snprintf(out,
                           outLen,
                           "{\"ok\":true,\"update_host\":\"%s\",\"update_path\":\"%s\"}",
                           host,
                           updatePath);
    return n > 0 && (size_t)n < outLen;
}

bool FirmwareUpdateModule::checkManifestJsonStream_(Print& out, char* errOut, size_t errOutLen)
{
    bool isBusy = false;
    bool hasPending = false;
    portENTER_CRITICAL(&lock_);
    isBusy = busy_;
    hasPending = queuedJob_.pending;
    portEXIT_CRITICAL(&lock_);
    if (isBusy || hasPending) {
        writeSimpleError_(errOut, errOutLen, "updater busy");
        return false;
    }

    char url[kUrlLen] = {0};
    if (!resolveUpdateUrl_("manifest.json", url, sizeof(url), errOut, errOutLen)) {
        return false;
    }

    HTTPClient http;
    configureDownloadHttp_(http);
    if (!http.begin(url)) {
        writeHttpBeginFailedError_("manifest", url, errOut, errOutLen);
        return false;
    }

    const int code = http.GET();
    if (code != HTTP_CODE_OK) {
        writeHttpCodeFailedError_("manifest", url, http, code, errOut, errOutLen);
        http.end();
        return false;
    }

    const String payload = http.getString();
    http.end();
    if (payload.length() == 0U) {
        writeSimpleError_(errOut, errOutLen, "manifest empty");
        return false;
    }

    JsonDocument doc(psramPreferredJsonAllocator());
    const DeserializationError jsonErr = deserializeJson(doc, payload);
    if (jsonErr || !doc.is<JsonObjectConst>()) {
        writeSimpleError_(errOut, errOutLen, "manifest invalid json");
        return false;
    }

    char safeUrl[kUrlLen] = {0};
    char current[48] = {0};
    snprintf(safeUrl, sizeof(safeUrl), "%s", url);
    snprintf(current, sizeof(current), "%s", FirmwareVersion::Full);
    sanitizeJsonString_(safeUrl);
    sanitizeJsonString_(current);

    out.print("{\"ok\":true,\"manifest_url\":\"");
    out.print(safeUrl);
    out.print("\",\"current\":{\"flowios3\":\"");
    out.print(current);
    out.print("\",\"esp32s3\":\"");
    out.print(current);
    out.print("\",\"waveshare\":\"");
    out.print(current);
    out.print("\"},\"manifest\":");
    out.print(payload);
    out.print("}");
    return true;
}

bool FirmwareUpdateModule::manifestUrl_(char* out, size_t outLen, char* errOut, size_t errOutLen)
{
    if (!out || outLen == 0) return false;
    out[0] = '\0';

    bool isBusy = false;
    bool hasPending = false;
    portENTER_CRITICAL(&lock_);
    isBusy = busy_;
    hasPending = queuedJob_.pending;
    portEXIT_CRITICAL(&lock_);
    if (isBusy || hasPending) {
        writeSimpleError_(errOut, errOutLen, "updater busy");
        return false;
    }

    return resolveUpdateUrl_("manifest.json", out, outLen, errOut, errOutLen);
}

bool FirmwareUpdateModule::setConfig_(const char* updateHost,
                                      const char* updatePath,
                                      char* errOut,
                                      size_t errOutLen)
{
    if (!cfgStore_) {
        writeSimpleError_(errOut, errOutLen, "config store unavailable");
        return false;
    }

    bool isBusy = false;
    bool hasPending = false;
    portENTER_CRITICAL(&lock_);
    isBusy = busy_;
    hasPending = queuedJob_.pending;
    portEXIT_CRITICAL(&lock_);
    if (isBusy || hasPending) {
        writeSimpleError_(errOut, errOutLen, "updater busy");
        return false;
    }

    if (updateHost) {
        if (!cfgStore_->set(updateHostVar_, updateHost)) {
            writeSimpleError_(errOut, errOutLen, "set update_host failed");
            return false;
        }
    }
    if (updatePath) {
        if (!cfgStore_->set(updatePathVar_, updatePath)) {
            writeSimpleError_(errOut, errOutLen, "set update_path failed");
            return false;
        }
    }

    return true;
}

bool FirmwareUpdateModule::startUpdate_(FirmwareUpdateTarget target,
                                        const char* url,
                                        uint32_t* operationIdOut,
                                        char* errOut,
                                        size_t errOutLen)
{
    if (operationIdOut) *operationIdOut = 0U;
    if (target == FirmwareUpdateTarget::Waveshare || target == FirmwareUpdateTarget::Spiffs) {
        writeSimpleError_(errOut, errOutLen,
                          "firmware and web interface must be installed as one release package");
        return false;
    }
    UpdateJob job{};
    job.target = target;
    if (!resolveUrl_(target, url, job.url, sizeof(job.url), errOut, errOutLen)) {
        return false;
    }

    if (target == FirmwareUpdateTarget::Nextion) {
        char filename[128]{};
        if (extractUrlFilename_(job.url, filename, sizeof(filename)) &&
            strncmp(filename, "FlowIO_Nextion_", 15U) == 0) {
            char compatibility[HMI_DISPLAY_MODEL_TEXT_MAX]{};
            char artifactVersion[HMI_DISPLAY_VERSION_TEXT_MAX]{};
            if (!parseNextionArtifactFilename(filename,
                                              compatibility, sizeof(compatibility),
                                              artifactVersion, sizeof(artifactVersion))) {
                writeSimpleError_(errOut, errOutLen, "invalid nextion artifact filename");
                return false;
            }
            if (!hmiSvc_ && services_) hmiSvc_ = services_->get<HmiService>(ServiceId::Hmi);
            HmiDisplayIdentity identity{};
            const bool detected = hmiSvc_ && hmiSvc_->getLocalDisplayIdentity &&
                hmiSvc_->getLocalDisplayIdentity(hmiSvc_->ctx, &identity);
            if (detected && !isNextionDisplayCompatible(identity, compatibility)) {
                writeSimpleError_(errOut, errOutLen,
                                  "nextion artifact incompatible with detected display");
                return false;
            }
        }
    }

    portENTER_CRITICAL(&lock_);
    if (busy_ || localReleaseActive_ || queuedJob_.pending || updateStartPending_) {
        portEXIT_CRITICAL(&lock_);
        writeSimpleError_(errOut, errOutLen, "updater busy");
        return false;
    }
    updateStartPending_ = true;
    job.operationId = nextOperationId_++;
    if (nextOperationId_ == 0U) nextOperationId_ = 1U;
    portEXIT_CRITICAL(&lock_);

    if (!persistReceipt_(target, job.operationId, FirmwareUpdateReceiptState::Running)) {
        portENTER_CRITICAL(&lock_);
        updateStartPending_ = false;
        portEXIT_CRITICAL(&lock_);
        writeSimpleError_(errOut, errOutLen, "failed to persist update operation");
        return false;
    }

    setStatus_(UpdateState::Queued, target, 0, "queued", job.operationId);
    portENTER_CRITICAL(&lock_);
    queuedJob_ = job;
    queuedJob_.pending = true;
    updateStartPending_ = false;
    portEXIT_CRITICAL(&lock_);

    if (operationIdOut) *operationIdOut = job.operationId;
    LOGI("Update queued operation_id=%lu target=%s url=%s",
         (unsigned long)job.operationId, targetStr_(target), job.url);
    return true;
}

bool FirmwareUpdateModule::queueNextionReboot_(char* errOut, size_t errOutLen)
{
    if (nextionRebootPin_ < 0) {
        writeSimpleError_(errOut, errOutLen, "nextion reboot pin not configured");
        return false;
    }

    portENTER_CRITICAL(&lock_);
    if (busy_ || localReleaseActive_ || queuedJob_.pending || nextionRebootQueued_) {
        portEXIT_CRITICAL(&lock_);
        writeSimpleError_(errOut, errOutLen, "updater busy");
        return false;
    }
    nextionRebootQueued_ = true;
    portEXIT_CRITICAL(&lock_);

    LOGI("Nextion reboot queued");
    return true;
}

bool FirmwareUpdateModule::runWaveshareUpdate_(const char* url, uint32_t operationId,
                                               char* errOut, size_t errOutLen)
{
    setStatus_(UpdateState::Downloading, FirmwareUpdateTarget::Waveshare, 0, "downloading", operationId);

    char signatureBase64[128] = {0};
    if (!fetchOtaSignature_(url,
                            signatureBase64,
                            sizeof(signatureBase64),
                            errOut,
                            errOutLen)) {
        return false;
    }

    HTTPClient http;
    configureDownloadHttp_(http);
    if (!http.begin(url)) {
        writeHttpBeginFailedError_("fichier de mise a jour", url, errOut, errOutLen);
        return false;
    }

    const int code = http.GET();
    const int32_t contentLength = http.getSize();
    if (code != HTTP_CODE_OK) {
        writeHttpCodeFailedError_("fichier de mise a jour", url, http, code, errOut, errOutLen);
        http.end();
        return false;
    }

    setStatus_(UpdateState::Flashing, FirmwareUpdateTarget::Waveshare, 0, "flashing", operationId);
    portENTER_CRITICAL(&lock_);
    activeTotalBytes_ = (contentLength > 0) ? (uint32_t)contentLength : 0U;
    activeSentBytes_ = 0;
    portEXIT_CRITICAL(&lock_);

    const esp_partition_t* runningPartition = esp_ota_get_running_partition();
    const esp_partition_t* updatePartition = esp_ota_get_next_update_partition(nullptr);
    if (!updatePartition) {
        writeSimpleError_(errOut, errOutLen, "ota partition unavailable");
        http.end();
        return false;
    }
    if (runningPartition && updatePartition->address == runningPartition->address) {
        writeSimpleError_(errOut, errOutLen, "ota target equals running partition");
        http.end();
        return false;
    }
    if (contentLength > 0 && (size_t)contentLength > updatePartition->size) {
        writeSimpleError_(errOut, errOutLen, "ota image too large for partition");
        http.end();
        return false;
    }

    attachWebInterfaceSvcIfNeeded_();
    if (webInterfaceSvc_ && webInterfaceSvc_->setPaused) {
        webInterfaceSvc_->setPaused(webInterfaceSvc_->ctx, true);
    }

    char failMsg[128] = {0};
    mbedtls_sha256_context sha256;
    mbedtls_sha256_init(&sha256);
    bool sha256Active = false;
    const size_t beginSize = (contentLength > 0) ? (size_t)contentLength : (size_t)UPDATE_SIZE_UNKNOWN;
    if (!Update.begin(beginSize, U_FLASH)) {
        snprintf(failMsg, sizeof(failMsg), "ota begin failed (%u)", (unsigned)Update.getError());
    } else if (mbedtls_sha256_starts(&sha256, 0) != 0) {
        snprintf(failMsg, sizeof(failMsg), "ota sha256 init failed");
        Update.abort();
    } else {
        sha256Active = true;
        auto* stream = http.getStreamPtr();
        int32_t remaining = contentLength;
        uint8_t buf[Limits::FirmwareUpdate::Http::StreamChunkBytes];
        uint32_t lastReadMs = millis();

        while (http.connected() && (contentLength <= 0 || remaining > 0)) {
            const size_t avail = stream ? stream->available() : 0;
            if (avail == 0U) {
                if (contentLength <= 0 && stream && !stream->connected()) {
                    break;
                }
                if ((millis() - lastReadMs) > Limits::FirmwareUpdate::Http::StreamReadTimeoutMs) {
                    snprintf(failMsg, sizeof(failMsg), "ota stream timeout");
                    break;
                }
                delay(1);
                continue;
            }

            const size_t toRead = (avail > sizeof(buf)) ? sizeof(buf) : avail;
            const int rd = stream->readBytes((char*)buf, toRead);
            if (rd <= 0) {
                delay(1);
                continue;
            }
            lastReadMs = millis();

            if (mbedtls_sha256_update(&sha256, buf, (size_t)rd) != 0) {
                snprintf(failMsg, sizeof(failMsg), "ota sha256 update failed");
                break;
            }
            const size_t wr = Update.write(buf, (size_t)rd);
            if (wr != (size_t)rd) {
                snprintf(failMsg, sizeof(failMsg), "ota write failed (%u)", (unsigned)Update.getError());
                break;
            }

            onProgressChunk_((uint32_t)wr);

            if (contentLength > 0) {
                remaining -= rd;
                if (remaining <= 0) {
                    break;
                }
            }
        }

        if (failMsg[0] == '\0' && contentLength > 0 && remaining > 0) {
            snprintf(failMsg, sizeof(failMsg), "incomplete download");
        }
        uint8_t digest[32] = {0};
        if (failMsg[0] == '\0' &&
            (!sha256Active || mbedtls_sha256_finish(&sha256, digest) != 0)) {
            snprintf(failMsg, sizeof(failMsg), "ota sha256 finish failed");
        }
        sha256Active = false;
        if (failMsg[0] == '\0' &&
            Security::otaSignatureRequired(FLOW_ALLOW_UNSIGNED_UPDATES != 0,
                                           signatureBase64[0] != '\0') &&
            !verifyOtaSignature(digest, signatureBase64)) {
            snprintf(failMsg, sizeof(failMsg), "Signature OTA invalide");
            if (webInterfaceSvc_ && webInterfaceSvc_->noteInvalidOtaSignature) {
                webInterfaceSvc_->noteInvalidOtaSignature(webInterfaceSvc_->ctx);
            }
        }
        if (failMsg[0] != '\0') {
            Update.abort();
        }
        if (failMsg[0] == '\0' && !Update.end()) {
            snprintf(failMsg, sizeof(failMsg), "ota end failed (%u)", (unsigned)Update.getError());
        }
        if (failMsg[0] == '\0' && !Update.isFinished()) {
            snprintf(failMsg, sizeof(failMsg), "ota not finished");
        }
    }
    mbedtls_sha256_free(&sha256);

    if (webInterfaceSvc_ && webInterfaceSvc_->setPaused) {
        webInterfaceSvc_->setPaused(webInterfaceSvc_->ctx, false);
    }

    http.end();

    if (failMsg[0] != '\0') {
        writeSimpleError_(errOut, errOutLen, failMsg);
        return false;
    }

    if (!persistReceipt_(FirmwareUpdateTarget::Waveshare, operationId,
                         FirmwareUpdateReceiptState::RebootPending)) {
        writeSimpleError_(errOut, errOutLen, "failed to persist update completion");
        return false;
    }
    setStatus_(UpdateState::Rebooting, FirmwareUpdateTarget::Waveshare, 100, "rebooting", operationId);
    delay(1800);
    ESP.restart();
    return true;
}

bool FirmwareUpdateModule::runNextionUpdate_(const char* url, uint32_t operationId,
                                             char* errOut, size_t errOutLen)
{
    if (nextionRxPin_ < 0 || nextionTxPin_ < 0) {
        writeSimpleError_(errOut, errOutLen, "nextion board pins not configured");
        return false;
    }

    setStatus_(UpdateState::Downloading, FirmwareUpdateTarget::Nextion, 0, "downloading", operationId);

#if FLOW_ALLOW_UNSIGNED_UPDATES == 0
    (void)url;
    writeSimpleError_(errOut,
                      errOutLen,
                      "Nextion distant desactive en mode OTA signee");
    return false;
#endif

    if (flowIoEnablePin_ >= 0) {
        pinMode(flowIoEnablePin_, OUTPUT);
        digitalWrite(flowIoEnablePin_, LOW);
    }

    if (nextionRebootPin_ >= 0) {
        pinMode(nextionRebootPin_, OUTPUT);
        digitalWrite(nextionRebootPin_, HIGH);
    }

    HTTPClient http;
    configureDownloadHttp_(http);
    if (!http.begin(url)) {
        writeHttpBeginFailedError_("fichier de mise a jour", url, errOut, errOutLen);
        if (flowIoEnablePin_ >= 0) {
            digitalWrite(flowIoEnablePin_, HIGH);
            pinMode(flowIoEnablePin_, INPUT);
        }
        return false;
    }

    const int code = http.GET();
    const int32_t contentLength = http.getSize();
    if (code != HTTP_CODE_OK) {
        writeHttpCodeFailedError_("fichier de mise a jour", url, http, code, errOut, errOutLen);
        http.end();
        if (flowIoEnablePin_ >= 0) {
            digitalWrite(flowIoEnablePin_, HIGH);
            pinMode(flowIoEnablePin_, INPUT);
        }
        return false;
    }
    if (contentLength <= 0) {
        writeSimpleError_(errOut, errOutLen, "invalid content-length");
        http.end();
        if (flowIoEnablePin_ >= 0) {
            digitalWrite(flowIoEnablePin_, HIGH);
            pinMode(flowIoEnablePin_, INPUT);
        }
        return false;
    }

    setStatus_(UpdateState::Flashing, FirmwareUpdateTarget::Nextion, 0, "flashing", operationId);
    portENTER_CRITICAL(&lock_);
    activeTotalBytes_ = (uint32_t)contentLength;
    activeSentBytes_ = 0;
    portEXIT_CRITICAL(&lock_);

    bool ok = false;
    ESPNexUpload nextion(nextionUploadBaud_, nextionRxPin_, nextionTxPin_);
    nextion.setUpdateProgressCallback([this]() {
        this->onProgressChunk_(2048U);
    });

    if (!nextion.prepareUpload((uint32_t)contentLength)) {
        writeSimpleError_(errOut, errOutLen, nextion.statusMessage.c_str());
    } else if (!nextion.upload(*http.getStreamPtr())) {
        writeSimpleError_(errOut, errOutLen, nextion.statusMessage.c_str());
    } else {
        ok = true;
    }
    nextion.end();

    pinMode(nextionRxPin_, INPUT);
    pinMode(nextionTxPin_, INPUT);

    http.end();
    if (flowIoEnablePin_ >= 0) {
        digitalWrite(flowIoEnablePin_, HIGH);
        pinMode(flowIoEnablePin_, INPUT);
    }

    if (!ok) return false;

    if (!persistReceipt_(FirmwareUpdateTarget::Nextion, operationId,
                         FirmwareUpdateReceiptState::Succeeded)) {
        writeSimpleError_(errOut, errOutLen, "failed to persist update completion");
        return false;
    }
    setStatus_(UpdateState::Done, FirmwareUpdateTarget::Nextion, 100,
               "nextion update complete", operationId);
    return true;
}

bool FirmwareUpdateModule::runNextionReboot_(char* errOut, size_t errOutLen)
{
    if (nextionRebootPin_ < 0) {
        writeSimpleError_(errOut, errOutLen, "nextion reboot pin not configured");
        return false;
    }

    pinMode(nextionRebootPin_, OUTPUT);
    digitalWrite(nextionRebootPin_, HIGH);
    vTaskDelay(pdMS_TO_TICKS(500));
    digitalWrite(nextionRebootPin_, LOW);
    vTaskDelay(pdMS_TO_TICKS(500));
    digitalWrite(nextionRebootPin_, HIGH);
    vTaskDelay(pdMS_TO_TICKS(500));
    digitalWrite(nextionRebootPin_, LOW);

    LOGI("Nextion reboot pulse sequence completed on pin=%d", (int)nextionRebootPin_);
    return true;
}

bool FirmwareUpdateModule::runSpiffsUpdate_(const char* url, uint32_t operationId,
                                            char* errOut, size_t errOutLen)
{
    setStatus_(UpdateState::Downloading, FirmwareUpdateTarget::Spiffs, 0, "downloading", operationId);

#if FLOW_ALLOW_UNSIGNED_UPDATES == 0
    (void)url;
    writeSimpleError_(errOut,
                      errOutLen,
                      "SPIFFS distant desactive en mode OTA signee");
    return false;
#endif

    HTTPClient http;
    configureDownloadHttp_(http);
    if (!http.begin(url)) {
        writeHttpBeginFailedError_("fichier de mise a jour", url, errOut, errOutLen);
        return false;
    }

    const int code = http.GET();
    const int32_t contentLength = http.getSize();
    if (code != HTTP_CODE_OK) {
        writeHttpCodeFailedError_("fichier de mise a jour", url, http, code, errOut, errOutLen);
        http.end();
        return false;
    }

    setStatus_(UpdateState::Flashing, FirmwareUpdateTarget::Spiffs, 0, "flashing spiffs", operationId);
    portENTER_CRITICAL(&lock_);
    activeTotalBytes_ = (contentLength > 0) ? (uint32_t)contentLength : 0U;
    activeSentBytes_ = 0;
    portEXIT_CRITICAL(&lock_);

    attachWebInterfaceSvcIfNeeded_();
    if (webInterfaceSvc_ && webInterfaceSvc_->setPaused) {
        webInterfaceSvc_->setPaused(webInterfaceSvc_->ctx, true);
    }

    char failMsg[128] = {0};
    const size_t beginSize = (contentLength > 0) ? (size_t)contentLength : (size_t)UPDATE_SIZE_UNKNOWN;
    if (!Update.begin(beginSize, U_SPIFFS)) {
        snprintf(failMsg, sizeof(failMsg), "spiffs begin failed (%u)", (unsigned)Update.getError());
    }

    auto* stream = http.getStreamPtr();
    uint8_t buf[Limits::FirmwareUpdate::Http::StreamChunkBytes];
    int32_t remaining = contentLength;
    uint32_t lastReadMs = millis();
    if (failMsg[0] == '\0') {
        while (http.connected() && (contentLength <= 0 || remaining > 0)) {
            const size_t avail = stream ? stream->available() : 0;
            if (avail == 0U) {
                if (contentLength <= 0 && stream && !stream->connected()) {
                    break;
                }
                if ((millis() - lastReadMs) > Limits::FirmwareUpdate::Http::StreamReadTimeoutMs) {
                    snprintf(failMsg, sizeof(failMsg), "spiffs stream timeout");
                    break;
                }
                delay(1);
                continue;
            }

            const size_t toRead = (avail > sizeof(buf)) ? sizeof(buf) : avail;
            const int rd = stream->readBytes((char*)buf, toRead);
            if (rd <= 0) {
                delay(1);
                continue;
            }
            lastReadMs = millis();

            const size_t wr = Update.write(buf, (size_t)rd);
            if (wr != (size_t)rd) {
                snprintf(failMsg, sizeof(failMsg), "spiffs write failed (%u)", (unsigned)Update.getError());
                break;
            }

            onProgressChunk_((uint32_t)wr);

            if (contentLength > 0) {
                remaining -= rd;
                if (remaining <= 0) break;
            }
        }
    }
    http.end();

    if (failMsg[0] == '\0' && contentLength > 0 && remaining > 0) {
        snprintf(failMsg, sizeof(failMsg), "incomplete download");
    }
    if (failMsg[0] == '\0' && !Update.end()) {
        snprintf(failMsg, sizeof(failMsg), "spiffs end failed (%u)", (unsigned)Update.getError());
    }
    if (failMsg[0] == '\0' && !Update.isFinished()) {
        snprintf(failMsg, sizeof(failMsg), "spiffs not finished");
    }

    if (webInterfaceSvc_ && webInterfaceSvc_->setPaused) {
        webInterfaceSvc_->setPaused(webInterfaceSvc_->ctx, false);
    }

    if (failMsg[0] != '\0') {
        writeSimpleError_(errOut, errOutLen, failMsg);
        return false;
    }

    if (!persistReceipt_(FirmwareUpdateTarget::Spiffs, operationId,
                         FirmwareUpdateReceiptState::RebootPending)) {
        writeSimpleError_(errOut, errOutLen, "failed to persist update completion");
        return false;
    }
    setStatus_(UpdateState::Rebooting, FirmwareUpdateTarget::Spiffs, 100, "rebooting", operationId);
    delay(1800);
    ESP.restart();
    return true;
}

bool FirmwareUpdateModule::localTransactionMatches_(uint32_t transactionId) const
{
    return localRelease_.active && transactionId != 0U && localRelease_.id == transactionId;
}

void FirmwareUpdateModule::resetLocalRelease_()
{
    if (localRelease_.shaActive) mbedtls_sha256_free(&localRelease_.shaContext);
    if (localRelease_.otaHandle != 0) (void)esp_ota_abort(localRelease_.otaHandle);
    localRelease_ = LocalReleaseTransaction{};
    portENTER_CRITICAL(&lock_);
    localReleaseActive_ = false;
    activeTotalBytes_ = 0U;
    activeSentBytes_ = 0U;
    portEXIT_CRITICAL(&lock_);
    setHmiOtaCondition_(false);
}

void FirmwareUpdateModule::failLocalRelease_(const char* reason)
{
    if (localRelease_.stage == LocalReleaseStage::Error) return;
    if (localRelease_.shaActive) {
        mbedtls_sha256_free(&localRelease_.shaContext);
        localRelease_.shaActive = false;
    }
    if (localRelease_.otaHandle != 0) {
        (void)esp_ota_abort(localRelease_.otaHandle);
        localRelease_.otaHandle = 0;
    }
    const FirmwareUpdateTarget target =
        localRelease_.stage == LocalReleaseStage::WritingFirmware ||
                localRelease_.stage == LocalReleaseStage::FirmwareVerified
            ? FirmwareUpdateTarget::Waveshare : FirmwareUpdateTarget::Spiffs;
    snprintf(localRelease_.failureReason, sizeof(localRelease_.failureReason), "%s",
             reason ? reason : "local release failed");
    localRelease_.stage = LocalReleaseStage::Error;
    setError_(target, localRelease_.failureReason, localRelease_.operationId);
}

bool FirmwareUpdateModule::beginLocalRelease_(const char* manifestJson,
                                               size_t manifestLen,
                                               uint32_t* transactionIdOut,
                                               char* errOut,
                                               size_t errOutLen)
{
    SemaphoreGuard guard(localReleaseMutex_);
    if (!guard.acquired()) return writeSimpleError_(errOut, errOutLen, "upgrade synchronization unavailable");
    if (transactionIdOut) *transactionIdOut = 0U;
    if (!manifestJson || manifestLen == 0U || manifestLen > 1024U) {
        return writeSimpleError_(errOut, errOutLen, "invalid release manifest");
    }
    JsonDocument doc(psramPreferredJsonAllocator());
    const auto jsonError = deserializeJson(doc, manifestJson, manifestLen);
    if (jsonError || !doc.is<JsonObjectConst>()) {
        return writeSimpleError_(errOut, errOutLen, "invalid release manifest json");
    }
    const char* version = doc["version"] | "";
    const JsonObjectConst firmware = doc["firmware"].as<JsonObjectConst>();
    const JsonObjectConst filesystem = doc["filesystem"].as<JsonObjectConst>();
    if ((doc["format"] | 0U) != 1U || strcmp(doc["product"] | "", "Flow.IO") != 0 ||
        strcmp(doc["hardware"] | "", "WaveshareESP32S3") != 0 || version[0] == '\0' ||
        firmware.isNull() || filesystem.isNull()) {
        return writeSimpleError_(errOut, errOutLen, "incompatible release manifest");
    }
    LocalReleaseTransaction candidate{};
    if (strlen(version) >= sizeof(candidate.version)) {
        return writeSimpleError_(errOut, errOutLen, "release version is too long");
    }
    candidate.targetSlot = ReleaseStorage::inactiveSlot();
    candidate.filesystem.size = filesystem["size"] | 0U;
    candidate.firmware.size = firmware["size"] | 0U;
    if (strcmp(firmware["file"] | "", "firmware.bin") != 0 ||
        strcmp(filesystem["file"] | "", "spiffs.bin") != 0 ||
        candidate.filesystem.size == 0U || candidate.firmware.size == 0U ||
        !parseSha256_(filesystem["sha256"] | "", candidate.filesystem.sha256) ||
        !parseSha256_(firmware["sha256"] | "", candidate.firmware.sha256)) {
        return writeSimpleError_(errOut, errOutLen, "incomplete release manifest");
    }
    const esp_partition_t* fsPartition = esp_partition_find_first(
        ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY,
        ReleaseStorage::filesystemLabel(candidate.targetSlot));
    const esp_partition_subtype_t appSubtype = candidate.targetSlot == ReleaseSlot::A
                                                   ? ESP_PARTITION_SUBTYPE_APP_OTA_0
                                                   : ESP_PARTITION_SUBTYPE_APP_OTA_1;
    const esp_partition_t* appPartition = esp_partition_find_first(
        ESP_PARTITION_TYPE_APP, appSubtype, ReleaseStorage::applicationLabel(candidate.targetSlot));
    if (!fsPartition || !appPartition || candidate.filesystem.size != fsPartition->size ||
        candidate.firmware.size > appPartition->size) {
        return writeSimpleError_(errOut, errOutLen, "release image exceeds target partition");
    }
    portENTER_CRITICAL(&lock_);
    if (busy_ || localReleaseActive_ || queuedJob_.pending || nextionRebootQueued_ || updateStartPending_) {
        portEXIT_CRITICAL(&lock_);
        return writeSimpleError_(errOut, errOutLen, "updater busy");
    }
    localReleaseActive_ = true;
    candidate.operationId = nextOperationId_++;
    if (nextOperationId_ == 0U) nextOperationId_ = 1U;
    portEXIT_CRITICAL(&lock_);
    candidate.active = true;
    candidate.id = esp_random();
    if (candidate.id == 0U) candidate.id = 1U;
    candidate.stage = LocalReleaseStage::Prepared;
    candidate.lastActivityMs = millis();
    snprintf(candidate.version, sizeof(candidate.version), "%s", version);
    localRelease_ = candidate;
    if (!persistReceipt_(FirmwareUpdateTarget::Waveshare, candidate.operationId,
                         FirmwareUpdateReceiptState::Running)) {
        resetLocalRelease_();
        return writeSimpleError_(errOut, errOutLen, "failed to persist local update operation");
    }
    if (transactionIdOut) *transactionIdOut = candidate.id;
    setStatus_(UpdateState::Queued, FirmwareUpdateTarget::Spiffs, 0U,
               "local release prepared", candidate.operationId);
    return true;
}

bool FirmwareUpdateModule::beginLocalImage_(uint32_t transactionId,
                                             FirmwareUpdateTarget target,
                                             size_t totalSize,
                                             char* errOut,
                                             size_t errOutLen)
{
    SemaphoreGuard guard(localReleaseMutex_);
    if (!guard.acquired()) return writeSimpleError_(errOut, errOutLen, "upgrade synchronization unavailable");
    if (!isLocalReleaseImageTarget_(target) || !localTransactionMatches_(transactionId)) {
        return writeSimpleError_(errOut, errOutLen, "unknown release transaction");
    }
    if (localRelease_.stage == LocalReleaseStage::Error) {
        return writeSimpleError_(errOut, errOutLen, localRelease_.failureReason);
    }
    const bool filesystemTarget = target == FirmwareUpdateTarget::Spiffs;
    const LocalImageManifest& image = filesystemTarget ? localRelease_.filesystem : localRelease_.firmware;
    const LocalReleaseStage expected = filesystemTarget ? LocalReleaseStage::Prepared
                                                        : LocalReleaseStage::FilesystemVerified;
    if (localRelease_.stage != expected || totalSize != image.size) {
        return writeSimpleError_(errOut, errOutLen, "unexpected release image");
    }
    const esp_partition_type_t type = filesystemTarget ? ESP_PARTITION_TYPE_DATA : ESP_PARTITION_TYPE_APP;
    const esp_partition_subtype_t subtype = filesystemTarget ? ESP_PARTITION_SUBTYPE_ANY
        : (localRelease_.targetSlot == ReleaseSlot::A ? ESP_PARTITION_SUBTYPE_APP_OTA_0
                                                      : ESP_PARTITION_SUBTYPE_APP_OTA_1);
    const char* label = filesystemTarget ? ReleaseStorage::filesystemLabel(localRelease_.targetSlot)
                                         : ReleaseStorage::applicationLabel(localRelease_.targetSlot);
    localRelease_.writePartition = esp_partition_find_first(type, subtype, label);
    if (!localRelease_.writePartition || totalSize > localRelease_.writePartition->size) {
        failLocalRelease_("target partition unavailable");
        return writeSimpleError_(errOut, errOutLen, "target partition unavailable");
    }
    const esp_err_t flashError = filesystemTarget
        ? esp_partition_erase_range(localRelease_.writePartition, 0U, localRelease_.writePartition->size)
        : esp_ota_begin(localRelease_.writePartition, totalSize, &localRelease_.otaHandle);
    if (flashError != ESP_OK) {
        failLocalRelease_("failed to initialize target partition");
        return writeSimpleError_(errOut, errOutLen, "failed to initialize target partition");
    }
    mbedtls_sha256_init(&localRelease_.shaContext);
    if (mbedtls_sha256_starts(&localRelease_.shaContext, 0) != 0) {
        failLocalRelease_("sha256 initialization failed");
        return writeSimpleError_(errOut, errOutLen, "sha256 initialization failed");
    }
    localRelease_.shaActive = true;
    localRelease_.received = 0U;
    localRelease_.lastActivityMs = millis();
    localRelease_.stage = filesystemTarget ? LocalReleaseStage::WritingFilesystem
                                           : LocalReleaseStage::WritingFirmware;
    portENTER_CRITICAL(&lock_);
    activeTotalBytes_ = (uint32_t)totalSize;
    activeSentBytes_ = 0U;
    portEXIT_CRITICAL(&lock_);
    setStatus_(UpdateState::Flashing, target, 0U,
               filesystemTarget ? "uploading release filesystem" : "uploading release firmware",
               localRelease_.operationId);
    return true;
}

bool FirmwareUpdateModule::writeLocalImage_(uint32_t transactionId,
                                             FirmwareUpdateTarget target,
                                             const uint8_t* data,
                                             size_t len,
                                             size_t offset,
                                             char* errOut,
                                             size_t errOutLen)
{
    SemaphoreGuard guard(localReleaseMutex_);
    if (!guard.acquired()) return writeSimpleError_(errOut, errOutLen, "upgrade synchronization unavailable");
    if (!localTransactionMatches_(transactionId) || !data || len == 0U) {
        return writeSimpleError_(errOut, errOutLen, "invalid release image chunk");
    }
    const bool filesystemTarget = target == FirmwareUpdateTarget::Spiffs;
    const LocalReleaseStage expected = filesystemTarget ? LocalReleaseStage::WritingFilesystem
                                                        : LocalReleaseStage::WritingFirmware;
    const size_t expectedSize = filesystemTarget ? localRelease_.filesystem.size : localRelease_.firmware.size;
    if (!isLocalReleaseImageTarget_(target) || localRelease_.stage != expected ||
        offset != localRelease_.received || len > expectedSize - localRelease_.received) {
        failLocalRelease_("out-of-order release image chunk");
        return writeSimpleError_(errOut, errOutLen, "out-of-order release image chunk");
    }
    const esp_err_t writeError = filesystemTarget
        ? esp_partition_write(localRelease_.writePartition, offset, data, len)
        : esp_ota_write(localRelease_.otaHandle, data, len);
    if (writeError != ESP_OK || mbedtls_sha256_update(&localRelease_.shaContext, data, len) != 0) {
        failLocalRelease_("release image write failed");
        return writeSimpleError_(errOut, errOutLen, "release image write failed");
    }
    localRelease_.received += len;
    localRelease_.lastActivityMs = millis();
    onProgressChunk_((uint32_t)len);
    return true;
}

bool FirmwareUpdateModule::endLocalImage_(uint32_t transactionId,
                                           FirmwareUpdateTarget target,
                                           char* errOut,
                                           size_t errOutLen)
{
    SemaphoreGuard guard(localReleaseMutex_);
    if (!guard.acquired()) return writeSimpleError_(errOut, errOutLen, "upgrade synchronization unavailable");
    if (!localTransactionMatches_(transactionId) || !isLocalReleaseImageTarget_(target)) {
        return writeSimpleError_(errOut, errOutLen, "unknown release transaction");
    }
    const bool filesystemTarget = target == FirmwareUpdateTarget::Spiffs;
    const LocalReleaseStage expected = filesystemTarget ? LocalReleaseStage::WritingFilesystem
                                                        : LocalReleaseStage::WritingFirmware;
    const LocalImageManifest& image = filesystemTarget ? localRelease_.filesystem : localRelease_.firmware;
    if (localRelease_.stage != expected || localRelease_.received != image.size || !localRelease_.shaActive) {
        failLocalRelease_("incomplete release image");
        return writeSimpleError_(errOut, errOutLen, "incomplete release image");
    }
    uint8_t digest[32]{};
    const int shaError = mbedtls_sha256_finish(&localRelease_.shaContext, digest);
    mbedtls_sha256_free(&localRelease_.shaContext);
    localRelease_.shaActive = false;
    if (shaError != 0 || !sha256Matches_(digest, image.sha256)) {
        failLocalRelease_("release image sha256 mismatch");
        return writeSimpleError_(errOut, errOutLen, "release image sha256 mismatch");
    }
    if (filesystemTarget) {
        if (!candidateFilesystemIsValid_(ReleaseStorage::filesystemLabel(localRelease_.targetSlot),
                                         localRelease_.version)) {
            failLocalRelease_("candidate filesystem validation failed");
            return writeSimpleError_(errOut, errOutLen, "candidate filesystem validation failed");
        }
        localRelease_.stage = LocalReleaseStage::FilesystemVerified;
    } else {
        if (esp_ota_end(localRelease_.otaHandle) != ESP_OK) {
            localRelease_.otaHandle = 0;
            failLocalRelease_("candidate firmware validation failed");
            return writeSimpleError_(errOut, errOutLen, "candidate firmware validation failed");
        }
        localRelease_.otaHandle = 0;
        localRelease_.stage = LocalReleaseStage::FirmwareVerified;
    }
    localRelease_.writePartition = nullptr;
    localRelease_.received = 0U;
    localRelease_.lastActivityMs = millis();
    portENTER_CRITICAL(&lock_);
    activeTotalBytes_ = 0U;
    activeSentBytes_ = 0U;
    portEXIT_CRITICAL(&lock_);
    setStatus_(UpdateState::Done, target, 100U,
               filesystemTarget ? "release filesystem verified" : "release firmware verified",
               localRelease_.operationId);
    return true;
}

bool FirmwareUpdateModule::commitLocalRelease_(uint32_t transactionId, char* errOut, size_t errOutLen)
{
    SemaphoreGuard guard(localReleaseMutex_);
    if (!guard.acquired()) return writeSimpleError_(errOut, errOutLen, "upgrade synchronization unavailable");
    if (!localTransactionMatches_(transactionId) || localRelease_.stage != LocalReleaseStage::FirmwareVerified) {
        return writeSimpleError_(errOut, errOutLen, "release is not ready to commit");
    }
    const esp_partition_subtype_t subtype = localRelease_.targetSlot == ReleaseSlot::A
        ? ESP_PARTITION_SUBTYPE_APP_OTA_0 : ESP_PARTITION_SUBTYPE_APP_OTA_1;
    const esp_partition_t* target = esp_partition_find_first(
        ESP_PARTITION_TYPE_APP, subtype, ReleaseStorage::applicationLabel(localRelease_.targetSlot));
    if (!target || !persistReceipt_(FirmwareUpdateTarget::Waveshare, localRelease_.operationId,
                                    FirmwareUpdateReceiptState::RebootPending) ||
        esp_ota_set_boot_partition(target) != ESP_OK) {
        failLocalRelease_("failed to select release boot partition");
        return writeSimpleError_(errOut, errOutLen, "failed to select release boot partition");
    }
    localRelease_.stage = LocalReleaseStage::ReadyToBoot;
    localRelease_.rebootPending = true;
    localRelease_.rebootAtMs = millis() + 1800U;
    setStatus_(UpdateState::Rebooting, FirmwareUpdateTarget::Waveshare, 100U,
               "release committed; rebooting", localRelease_.operationId);
    return true;
}

bool FirmwareUpdateModule::abortLocalRelease_(uint32_t transactionId, char* errOut, size_t errOutLen)
{
    SemaphoreGuard guard(localReleaseMutex_);
    if (!guard.acquired()) return writeSimpleError_(errOut, errOutLen, "upgrade synchronization unavailable");
    if (!localTransactionMatches_(transactionId)) {
        return writeSimpleError_(errOut, errOutLen, "unknown release transaction");
    }
    if (localRelease_.rebootPending) {
        return writeSimpleError_(errOut, errOutLen, "committed release cannot be aborted");
    }
    const uint32_t operationId = localRelease_.operationId;
    (void)persistReceipt_(FirmwareUpdateTarget::Waveshare, operationId, FirmwareUpdateReceiptState::Failed);
    resetLocalRelease_();
    setStatus_(UpdateState::Idle, FirmwareUpdateTarget::Waveshare, 0U,
               "local release aborted", operationId);
    return true;
}

bool FirmwareUpdateModule::runJob_(const UpdateJob& job)
{
    if (!netAccessSvc_ && services_) {
        netAccessSvc_ = services_->get<NetworkAccessService>(ServiceId::NetworkAccess);
    }
    bool netReady = false;
    if (netAccessSvc_ && netAccessSvc_->isWebReachable) {
        netReady = netAccessSvc_->isWebReachable(netAccessSvc_->ctx);
    } else if (wifiSvc_ && wifiSvc_->isConnected) {
        netReady = wifiSvc_->isConnected(wifiSvc_->ctx);
    }
    if (!netReady) {
        (void)persistReceipt_(job.target, job.operationId, FirmwareUpdateReceiptState::Failed);
        setError_(job.target, "network not connected", job.operationId);
        return false;
    }

    char err[128] = {0};
    bool ok = false;
    switch (job.target) {
        case FirmwareUpdateTarget::Waveshare:
            ok = runWaveshareUpdate_(job.url, job.operationId, err, sizeof(err));
            break;
        case FirmwareUpdateTarget::Nextion:
            ok = runNextionUpdate_(job.url, job.operationId, err, sizeof(err));
            break;
        case FirmwareUpdateTarget::Spiffs:
            ok = runSpiffsUpdate_(job.url, job.operationId, err, sizeof(err));
            break;
        default:
            snprintf(err, sizeof(err), "unsupported target");
            ok = false;
            break;
    }

    if (!ok) {
        (void)persistReceipt_(job.target, job.operationId, FirmwareUpdateReceiptState::Failed);
        setError_(job.target, err[0] ? err : "update failed", job.operationId);
        LOGE("Update failed target=%s reason=%s", targetStr_(job.target), err[0] ? err : "unknown");
        return false;
    }

    LOGI("Update done target=%s", targetStr_(job.target));
    return true;
}

bool FirmwareUpdateModule::cmdStatus_(void* userCtx, const CommandRequest&, char* reply, size_t replyLen)
{
    FirmwareUpdateModule* self = static_cast<FirmwareUpdateModule*>(userCtx);
    if (!self) return false;
    if (!self->statusJson_(reply, replyLen)) {
        if (!writeErrorJson(reply, replyLen, ErrorCode::Failed, "fw.update.status")) {
            snprintf(reply, replyLen, "{\"ok\":false}");
        }
        return false;
    }
    return true;
}

bool FirmwareUpdateModule::cmdWaveshare_(void* userCtx, const CommandRequest& req, char* reply, size_t replyLen)
{
    FirmwareUpdateModule* self = static_cast<FirmwareUpdateModule*>(userCtx);
    if (!self) return false;

    char url[kUrlLen] = {0};
    const char* explicitUrl = self->parseUrlArg_(req, url, sizeof(url)) ? url : nullptr;
    char err[120] = {0};
    uint32_t operationId = 0U;
    if (!self->startUpdate_(FirmwareUpdateTarget::Waveshare,
                            explicitUrl,
                            &operationId,
                            err,
                            sizeof(err))) {
        if (!writeErrorJson(reply, replyLen, ErrorCode::Failed, "fw.update.waveshare")) {
            snprintf(reply, replyLen, "{\"ok\":false}");
        }
        return false;
    }

    snprintf(reply,
             replyLen,
             "{\"ok\":true,\"queued\":true,\"target\":\"waveshare\",\"operation_id\":%lu}",
             (unsigned long)operationId);
    return true;
}

bool FirmwareUpdateModule::cmdNextion_(void* userCtx, const CommandRequest& req, char* reply, size_t replyLen)
{
    FirmwareUpdateModule* self = static_cast<FirmwareUpdateModule*>(userCtx);
    if (!self) return false;

    char url[kUrlLen] = {0};
    const char* explicitUrl = self->parseUrlArg_(req, url, sizeof(url)) ? url : nullptr;
    char err[120] = {0};
    uint32_t operationId = 0U;
    if (!self->startUpdate_(FirmwareUpdateTarget::Nextion,
                            explicitUrl,
                            &operationId,
                            err,
                            sizeof(err))) {
        if (!writeErrorJson(reply, replyLen, ErrorCode::Failed, "fw.update.nextion")) {
            snprintf(reply, replyLen, "{\"ok\":false}");
        }
        return false;
    }

    snprintf(reply,
             replyLen,
             "{\"ok\":true,\"queued\":true,\"target\":\"nextion\",\"operation_id\":%lu}",
             (unsigned long)operationId);
    return true;
}

bool FirmwareUpdateModule::cmdNextionReboot_(void* userCtx, const CommandRequest&, char* reply, size_t replyLen)
{
    FirmwareUpdateModule* self = static_cast<FirmwareUpdateModule*>(userCtx);
    if (!self) return false;

    char err[120] = {0};
    if (!self->queueNextionReboot_(err, sizeof(err))) {
        sanitizeJsonString_(err);
        const int wrote = snprintf(reply,
                                   replyLen,
                                   "{\"ok\":false,\"err\":{\"code\":\"Failed\",\"where\":\"fw.nextion.reboot\",\"msg\":\"%s\"}}",
                                   err[0] ? err : "failed");
        return wrote > 0 && (size_t)wrote < replyLen;
    }

    snprintf(reply, replyLen, "{\"ok\":true,\"queued\":true,\"target\":\"nextion_reboot\"}");
    return true;
}

bool FirmwareUpdateModule::cmdSpiffs_(void* userCtx, const CommandRequest& req, char* reply, size_t replyLen)
{
    FirmwareUpdateModule* self = static_cast<FirmwareUpdateModule*>(userCtx);
    if (!self) return false;

    char url[kUrlLen] = {0};
    const char* explicitUrl = self->parseUrlArg_(req, url, sizeof(url)) ? url : nullptr;
    char err[120] = {0};
    uint32_t operationId = 0U;
    if (!self->startUpdate_(FirmwareUpdateTarget::Spiffs,
                            explicitUrl,
                            &operationId,
                            err,
                            sizeof(err))) {
        if (!writeErrorJson(reply, replyLen, ErrorCode::Failed, "fw.update.spiffs")) {
            snprintf(reply, replyLen, "{\"ok\":false}");
        }
        return false;
    }

    snprintf(reply,
             replyLen,
             "{\"ok\":true,\"queued\":true,\"target\":\"spiffs\",\"operation_id\":%lu}",
             (unsigned long)operationId);
    return true;
}

void FirmwareUpdateModule::init(ConfigStore& cfg, ServiceRegistry& services)
{
    services_ = &services;
    cfgStore_ = &cfg;
    logHub_ = services.get<LogHubService>(ServiceId::LogHub);
    cmdSvc_ = services.get<CommandService>(ServiceId::Command);
    wifiSvc_ = services.get<WifiService>(ServiceId::Wifi);
    netAccessSvc_ = services.get<NetworkAccessService>(ServiceId::NetworkAccess);
    webInterfaceSvc_ = services.get<WebInterfaceService>(ServiceId::WebInterface);
    flowCfgSvc_ = services.get<FlowCfgRemoteService>(ServiceId::FlowCfg);
    hmiSvc_ = services.get<HmiService>(ServiceId::Hmi);

    cfg.registerVar(updateHostVar_);
    cfg.registerVar(updatePathVar_);

    bootId_ = esp_random();
    if (bootId_ == 0U) bootId_ = 1U;
    if (loadReceipt_()) {
        nextOperationId_ = lastReceipt_.operationId + 1U;
        if (nextOperationId_ == 0U) nextOperationId_ = 1U;
    } else {
        nextOperationId_ = esp_random();
        if (nextOperationId_ == 0U) nextOperationId_ = 1U;
    }

    if (!services.add(ServiceId::FirmwareUpdate, &firmwareUpdateSvc_)) {
        LOGE("service registration failed: %s", toString(ServiceId::FirmwareUpdate));
    }

    if (cmdSvc_ && cmdSvc_->registerHandler) {
        cmdSvc_->registerHandler(cmdSvc_->ctx, "fw.update.status", &FirmwareUpdateModule::cmdStatus_, this);
        cmdSvc_->registerHandler(cmdSvc_->ctx, "fw.update.waveshare", &FirmwareUpdateModule::cmdWaveshare_, this);
        cmdSvc_->registerHandler(cmdSvc_->ctx, "fw.update.nextion", &FirmwareUpdateModule::cmdNextion_, this);
        cmdSvc_->registerHandler(cmdSvc_->ctx, "fw.nextion.reboot", &FirmwareUpdateModule::cmdNextionReboot_, this);
        cmdSvc_->registerHandler(cmdSvc_->ctx, "fw.update.spiffs", &FirmwareUpdateModule::cmdSpiffs_, this);
    }

    setStatus_(UpdateState::Idle, FirmwareUpdateTarget::Waveshare, 0, "idle", 0U);
    LOGI("Firmware updater ready");
}

void FirmwareUpdateModule::loop()
{
    bool localReleaseRebootDue = false;
    {
        SemaphoreGuard guard(localReleaseMutex_, 0U);
        if (guard.acquired()) {
            const uint32_t nowMs = millis();
            localReleaseRebootDue = localRelease_.rebootPending &&
                                    (int32_t)(nowMs - localRelease_.rebootAtMs) >= 0;
            if (localRelease_.active && !localRelease_.rebootPending &&
                localRelease_.lastActivityMs != 0U &&
                (uint32_t)(nowMs - localRelease_.lastActivityMs) > 120000U) {
                const uint32_t operationId = localRelease_.operationId;
                (void)persistReceipt_(FirmwareUpdateTarget::Waveshare, operationId,
                                      FirmwareUpdateReceiptState::Failed);
                resetLocalRelease_();
                setError_(FirmwareUpdateTarget::Waveshare, "local release timed out", operationId);
            }
        }
    }
    if (localReleaseRebootDue) {
        delay(20);
        ESP.restart();
        return;
    }

    UpdateJob job{};
    bool runNextionReboot = false;

    portENTER_CRITICAL(&lock_);
    if (busy_) {
        portEXIT_CRITICAL(&lock_);
        vTaskDelay(pdMS_TO_TICKS(60));
        return;
    }
    if (nextionRebootQueued_) {
        busy_ = true;
        nextionRebootQueued_ = false;
        runNextionReboot = true;
    } else if (queuedJob_.pending) {
        busy_ = true;
        job = queuedJob_;
        queuedJob_.pending = false;
    } else {
        portEXIT_CRITICAL(&lock_);
        vTaskDelay(pdMS_TO_TICKS(60));
        return;
    }
    portEXIT_CRITICAL(&lock_);

    if (runNextionReboot) {
        char err[128] = {0};
        if (!runNextionReboot_(err, sizeof(err))) {
            LOGE("Nextion reboot failed reason=%s", err[0] ? err : "unknown");
        } else {
            LOGI("Nextion reboot done");
        }
    } else {
        runJob_(job);
    }

    portENTER_CRITICAL(&lock_);
    busy_ = false;
    activeTotalBytes_ = 0;
    activeSentBytes_ = 0;
    portEXIT_CRITICAL(&lock_);

    vTaskDelay(pdMS_TO_TICKS(20));
}
