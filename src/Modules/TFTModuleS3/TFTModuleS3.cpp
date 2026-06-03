/**
 * @file TFTModuleS3.cpp
 * @brief Local Waveshare ESP32-S3 TFT display.
 */

#include "Modules/TFTModuleS3/TFTModuleS3.h"

#include <Arduino.h>
#include <stdio.h>
#include <string.h>

#include "Board/BoardSpec.h"
#include "Core/DataKeys.h"
#include "Core/EventBus/EventPayloads.h"
#include "Core/FirmwareVersion.h"
#include "Core/Generated/RuntimeUiManifest_Generated.h"
#include "Core/SystemStats.h"
#include "Domain/Pool/PoolBindings.h"
#include "Modules/IOModule/IORuntime.h"
#include "Modules/Network/MQTTModule/MQTTRuntime.h"
#include "Modules/Network/WifiModule/WifiRuntime.h"
#include "Modules/PoolDeviceModule/PoolDeviceRuntime.h"
#include <WiFi.h>

#define LOG_MODULE_ID ((LogModuleId)LogModuleIdValue::HMIModule)
#include "Core/ModuleLog.h"

namespace {
constexpr uint8_t kCfgProducerId = 54;
constexpr uint8_t kCfgBranch = 1;
constexpr uint8_t kCfgBranchSlotBase = 16;
constexpr uint16_t kCfgMsgSlotBase = 16U;
constexpr uint32_t kRenderPeriodMs = 1000U;
constexpr uint32_t kFullRedrawPeriodMs = 30000U;
constexpr uint32_t kBacklightTimeoutMs = 60000U;
constexpr uint16_t kBlack = 0x0000;
constexpr uint16_t kWhite = 0xFFFF;
constexpr uint16_t kMuted = 0x8410;
constexpr uint16_t kBlue = 0x02DF;
constexpr uint16_t kGreen = 0x07E0;
constexpr uint16_t kRed = 0xF800;
constexpr uint16_t kYellow = 0xFFE0;
constexpr uint16_t kPanel = 0x2104;

struct DashboardColorPreset {
    uint8_t id;
    uint16_t rgb565;
};

constexpr uint16_t rgb565_(uint8_t r, uint8_t g, uint8_t b)
{
    return (uint16_t)((r >> 3) << 11) | (uint16_t)((g >> 3) << 5) | (uint16_t)(b >> 3);
}

constexpr RuntimeUiId kDashboardDefaultRuntimeUiIds[TFTModuleS3::DashboardSlotCount] = {
    makeRuntimeUiId(ModuleId::Io, 1),
    makeRuntimeUiId(ModuleId::Io, 2),
    makeRuntimeUiId(ModuleId::Io, 3),
    makeRuntimeUiId(ModuleId::Io, 4),
    makeRuntimeUiId(ModuleId::Io, 5),
    makeRuntimeUiId(ModuleId::Io, 8),
    makeRuntimeUiId(ModuleId::Io, 7),
    makeRuntimeUiId(ModuleId::Io, 6),
};

constexpr const char* kDashboardDefaultLabels[TFTModuleS3::DashboardSlotCount] = {
    "Eau",
    "Air",
    "pH",
    "ORP",
    "Compteur",
    "BME680",
    "BMP280",
    "PSI",
};

constexpr DashboardColorPreset kDashboardColorPresets[] = {
    {0U, rgb565_(230, 239, 255)},
    {1U, rgb565_(229, 248, 252)},
    {2U, rgb565_(232, 250, 239)},
    {3U, rgb565_(240, 234, 254)},
    {4U, rgb565_(228, 246, 250)},
    {5U, rgb565_(227, 247, 254)},
    {6U, rgb565_(234, 248, 253)},
    {7U, rgb565_(254, 240, 232)},
    {8U, rgb565_(252, 231, 239)},
    {9U, rgb565_(255, 240, 225)},
    {10U, rgb565_(255, 247, 217)},
    {11U, rgb565_(237, 248, 231)},
    {12U, rgb565_(240, 250, 230)},
    {13U, rgb565_(245, 238, 255)},
    {14U, rgb565_(235, 238, 255)},
    {15U, rgb565_(238, 247, 255)},
    {16U, rgb565_(244, 250, 222)},
    {17U, rgb565_(255, 233, 228)},
    {18U, rgb565_(249, 238, 232)},
    {19U, rgb565_(241, 244, 248)},
    {20U, rgb565_(255, 255, 255)},
};

constexpr uint8_t kDashboardDefaultColorIds[TFTModuleS3::DashboardSlotCount] = {
    0U,
    1U,
    2U,
    3U,
    4U,
    5U,
    6U,
    7U,
};

const SupervisorBoardSpec& fallbackBoardSpec_()
{
    static constexpr SupervisorBoardSpec kFallback{
        {
            240,
            320,
            1,
            0,
            0,
            1,
            21,
            45,
            2,
            -1,
            47,
            48,
            false,
            true,
            40000000U,
            80
        },
        {
            11,
            120,
            true,
            -1,
            40
        },
        {
            -1,
            -1,
            -1,
            115200U
        }
    };
    return kFallback;
}
} // namespace

TFTModuleS3::TFTModuleS3(const BoardSpec& board)
    : displayCfg_(displaySpecFromBoard_(board)),
      display_(&spiBus_, displayCfg_.csPin, displayCfg_.dcPin, displayCfg_.rstPin)
{
    const SupervisorBoardSpec* sup = boardSupervisorConfig(board);
    const SupervisorBoardSpec& cfg = sup ? *sup : fallbackBoardSpec_();
    cfgData_.motionGpio = cfg.inputs.pirPin;
    pirDebounceMs_ = cfg.inputs.pirDebounceMs;
    pirActiveHigh_ = cfg.inputs.pirActiveHigh;
    lastMotionMs_ = millis();

    cfgRoutes_[0] = {1, {(uint8_t)ConfigModuleId::TftS3, kCfgBranch}, "tft/s3", "tft/s3", (uint8_t)MqttPublishPriority::Normal, nullptr};

    for (uint8_t i = 0; i < DashboardSlotCount; ++i) {
        DashboardSlotConfig& slotCfg = dashboardCfg_[i];
        slotCfg.enabled = true;
        slotCfg.runtimeUiId = kDashboardDefaultRuntimeUiIds[i];
        slotCfg.colorId = kDashboardDefaultColorIds[i];
        snprintf(slotCfg.label, sizeof(slotCfg.label), "%s", kDashboardDefaultLabels[i]);

        snprintf(dashboardModuleNames_[i], sizeof(dashboardModuleNames_[i]), "tft/s3/slots/slot%02u", (unsigned)i);
        snprintf(dashboardEnabledKeys_[i], sizeof(dashboardEnabledKeys_[i]), "tfs%02uen", (unsigned)i);
        snprintf(dashboardRuntimeIdKeys_[i], sizeof(dashboardRuntimeIdKeys_[i]), "tfs%02uri", (unsigned)i);
        snprintf(dashboardLabelKeys_[i], sizeof(dashboardLabelKeys_[i]), "tfs%02ulb", (unsigned)i);
        snprintf(dashboardColorIdKeys_[i], sizeof(dashboardColorIdKeys_[i]), "tfs%02uc", (unsigned)i);

        dashboardEnabledVars_[i].nvsKey = dashboardEnabledKeys_[i];
        dashboardEnabledVars_[i].jsonName = "enabled";
        dashboardEnabledVars_[i].moduleName = dashboardModuleNames_[i];
        dashboardEnabledVars_[i].type = ConfigType::Bool;
        dashboardEnabledVars_[i].value = &slotCfg.enabled;
        dashboardEnabledVars_[i].persistence = ConfigPersistence::Persistent;
        dashboardEnabledVars_[i].size = 0U;

        dashboardRuntimeIdVars_[i].nvsKey = dashboardRuntimeIdKeys_[i];
        dashboardRuntimeIdVars_[i].jsonName = "runtime_ui_id";
        dashboardRuntimeIdVars_[i].moduleName = dashboardModuleNames_[i];
        dashboardRuntimeIdVars_[i].type = ConfigType::UInt16;
        dashboardRuntimeIdVars_[i].value = &slotCfg.runtimeUiId;
        dashboardRuntimeIdVars_[i].persistence = ConfigPersistence::Persistent;
        dashboardRuntimeIdVars_[i].size = 0U;

        dashboardLabelVars_[i].nvsKey = dashboardLabelKeys_[i];
        dashboardLabelVars_[i].jsonName = "label";
        dashboardLabelVars_[i].moduleName = dashboardModuleNames_[i];
        dashboardLabelVars_[i].type = ConfigType::CharArray;
        dashboardLabelVars_[i].value = slotCfg.label;
        dashboardLabelVars_[i].persistence = ConfigPersistence::Persistent;
        dashboardLabelVars_[i].size = sizeof(slotCfg.label);

        dashboardColorIdVars_[i].nvsKey = dashboardColorIdKeys_[i];
        dashboardColorIdVars_[i].jsonName = "color_id";
        dashboardColorIdVars_[i].moduleName = dashboardModuleNames_[i];
        dashboardColorIdVars_[i].type = ConfigType::UInt8;
        dashboardColorIdVars_[i].value = &slotCfg.colorId;
        dashboardColorIdVars_[i].persistence = ConfigPersistence::Persistent;
        dashboardColorIdVars_[i].size = 0U;

        cfgRoutes_[1U + i] = {
            (uint16_t)(kCfgMsgSlotBase + i),
            {(uint8_t)ConfigModuleId::TftS3, (uint8_t)(kCfgBranchSlotBase + i)},
            dashboardModuleNames_[i],
            dashboardModuleNames_[i],
            (uint8_t)MqttPublishPriority::Normal,
            nullptr
        };
    }
}

St7789DisplaySpec TFTModuleS3::displaySpecFromBoard_(const BoardSpec& board)
{
    const SupervisorBoardSpec* sup = boardSupervisorConfig(board);
    return sup ? sup->display : fallbackBoardSpec_().display;
}

void TFTModuleS3::init(ConfigStore& cfg, ServiceRegistry& services)
{
    constexpr uint8_t module = (uint8_t)ConfigModuleId::TftS3;
    cfg.registerVar(enabledVar_, module, kCfgBranch);
    cfg.registerVar(autoOffVar_, module, kCfgBranch);
    cfg.registerVar(motionGpioVar_, module, kCfgBranch);

    for (uint8_t i = 0; i < DashboardSlotCount; ++i) {
        const uint8_t branch = (uint8_t)(kCfgBranchSlotBase + i);
        cfg.registerVar(dashboardEnabledVars_[i], module, branch);
        cfg.registerVar(dashboardRuntimeIdVars_[i], module, branch);
        cfg.registerVar(dashboardLabelVars_[i], module, branch);
        cfg.registerVar(dashboardColorIdVars_[i], module, branch);
    }

    ioSvc_ = services.get<IOServiceV2>(ServiceId::Io);
    dsSvc_ = services.get<DataStoreService>(ServiceId::DataStore);
    const EventBusService* ebSvc = services.get<EventBusService>(ServiceId::EventBus);
    eventBus_ = ebSvc ? ebSvc->bus : nullptr;

    if (eventBus_) {
        eventBus_->subscribe(EventId::ConfigChanged, &TFTModuleS3::onEventStatic_, this);
        eventBus_->subscribe(EventId::DataChanged, &TFTModuleS3::onEventStatic_, this);
    }
}

void TFTModuleS3::onConfigLoaded(ConfigStore&, ServiceRegistry& services)
{
    if (!cfgMqttPubConfigured_) {
        cfgMqttPub_.configure(this,
                              kCfgProducerId,
                              cfgRoutes_,
                              (uint8_t)(sizeof(cfgRoutes_) / sizeof(cfgRoutes_[0])),
                              services);
        cfgMqttPubConfigured_ = true;
    }
    updateMotionInput_();
    redrawRequested_ = true;
}

void TFTModuleS3::loop()
{
    if (!cfgData_.enabled) {
        applyBacklight_(false);
        delay(250);
        return;
    }

    if (!beginDisplay_()) {
        delay(500);
        return;
    }

    updateBacklight_();
    const uint32_t now = millis();
    const bool force = redrawRequested_ || ((now - lastFullRedrawMs_) >= kFullRedrawPeriodMs);
    if (force || (now - lastRenderMs_) >= kRenderPeriodMs) {
        render_(force);
    }
    delay(30);
}

void TFTModuleS3::onEventStatic_(const Event& e, void* user)
{
    TFTModuleS3* self = static_cast<TFTModuleS3*>(user);
    if (self) self->onEvent_(e);
}

void TFTModuleS3::onEvent_(const Event& e)
{
    if (e.id == EventId::ConfigChanged && e.payload && e.len >= sizeof(ConfigChangedPayload)) {
        const ConfigChangedPayload* p = static_cast<const ConfigChangedPayload*>(e.payload);
        if (p->moduleId == (uint8_t)ConfigModuleId::TftS3) {
            updateMotionInput_();
            redrawRequested_ = true;
        }
        return;
    }
    if (e.id == EventId::DataChanged) {
        redrawRequested_ = true;
    }
}

bool TFTModuleS3::beginDisplay_()
{
    if (displayReady_) return true;
    if (displayCfg_.csPin < 0 || displayCfg_.dcPin < 0 || displayCfg_.mosiPin < 0 || displayCfg_.sclkPin < 0) {
        LOGW("TFT disabled: invalid SPI pins");
        return false;
    }

    spiBus_.begin(displayCfg_.sclkPin, displayCfg_.misoPin, displayCfg_.mosiPin, displayCfg_.csPin);
    if (displayCfg_.backlightPin >= 0) {
        pinMode(displayCfg_.backlightPin, OUTPUT);
        digitalWrite(displayCfg_.backlightPin, HIGH);
        backlightOn_ = true;
    }
    display_.setSPISpeed(displayCfg_.spiHz);
    display_.init(displayCfg_.resX, displayCfg_.resY);
    display_.setRotation(displayCfg_.rotation & 0x03U);
    display_.invertDisplay(displayCfg_.invertColors);
    display_.setTextWrap(false);
    display_.fillScreen(color_(kBlack));
    displayReady_ = true;
    redrawRequested_ = true;
    LOGI("TFT S3 ready %ux%u", (unsigned)displayCfg_.resX, (unsigned)displayCfg_.resY);
    return true;
}

void TFTModuleS3::applyBacklight_(bool on)
{
    if (backlightOn_ == on) return;
    if (displayCfg_.backlightPin >= 0) {
        pinMode(displayCfg_.backlightPin, OUTPUT);
        digitalWrite(displayCfg_.backlightPin, on ? HIGH : LOW);
    }
    backlightOn_ = on;
    if (on) redrawRequested_ = true;
}

void TFTModuleS3::updateMotionInput_()
{
    int32_t pin = cfgData_.motionGpio;
    if (pin < 0 || pin > 48) pin = -1;
    if (motionInputConfigured_ && appliedMotionGpio_ == pin) return;

    appliedMotionGpio_ = pin;
    motionInputConfigured_ = (pin >= 0);
    pirRawState_ = false;
    pirStableState_ = false;
    pirDebounceChangedAtMs_ = millis();
    if (motionInputConfigured_) {
        pinMode((uint8_t)appliedMotionGpio_, INPUT);
        lastMotionMs_ = millis();
    }
}

void TFTModuleS3::updateBacklight_()
{
    if (!cfgData_.autoOff60s || !motionInputConfigured_) {
        applyBacklight_(true);
        return;
    }

    const uint32_t now = millis();
    const bool rawActive = (digitalRead((uint8_t)appliedMotionGpio_) == (pirActiveHigh_ ? HIGH : LOW));
    if (rawActive != pirRawState_) {
        pirRawState_ = rawActive;
        pirDebounceChangedAtMs_ = now;
    }
    if ((now - pirDebounceChangedAtMs_) >= pirDebounceMs_ && pirStableState_ != pirRawState_) {
        pirStableState_ = pirRawState_;
        if (pirStableState_) lastMotionMs_ = now;
    }
    applyBacklight_((now - lastMotionMs_) < kBacklightTimeoutMs);
}

void TFTModuleS3::render_(bool force)
{
    if (!displayReady_) return;
    if (!backlightOn_ && !force) return;

    const uint32_t now = millis();
    if (!force && (now - lastRenderMs_) < displayCfg_.minRenderGapMs) return;

    const DataStore* ds = dsSvc_ ? dsSvc_->store : nullptr;
    const bool netOk = ds ? networkReady(*ds) : false;
    const bool mqttOk = ds ? mqttReady(*ds) : false;
    char ip[20] = {0};
    formatIp_(ip, sizeof(ip));

    SystemStatsSnapshot stats{};
    SystemStats::collect(stats);

    display_.fillScreen(color_(kBlack));
    display_.setTextSize(2);
    display_.setTextColor(color_(kWhite), color_(kBlack));
    display_.setCursor(10, 10);
    display_.print("Flow.io S3");
    drawStatusPill_(10, 38, "NET", netOk);
    drawStatusPill_(86, 38, "MQTT", mqttOk);

    display_.setTextSize(1);
    display_.setTextColor(color_(kMuted), color_(kBlack));
    display_.setCursor(184, 20);
    display_.print("TFT");

    drawTextLine_(10, 68, "IP", ip, netOk ? color_(kWhite) : color_(kMuted));

    char buf[28] = {0};
    snprintf(buf, sizeof(buf), "%lu min", (unsigned long)(stats.uptimeMs64 / 60000ULL));
    drawTextLine_(10, 90, "Uptime", buf, color_(kWhite));
    snprintf(buf, sizeof(buf), "%lu KB", (unsigned long)(stats.heap.freeBytes / 1024U));
    drawTextLine_(10, 112, "Heap", buf, color_(stats.heap.freeBytes > 32768U ? kGreen : kYellow));

    display_.fillRect(10, 126, 220, 1, color_(kPanel));
    display_.setTextSize(1);
    display_.setTextColor(color_(kMuted), color_(kBlack));
    display_.setCursor(10, 134);
    display_.print("Runtime local");

    const int16_t slotW = 150;
    const int16_t slotH = 20;
    const int16_t x0 = 10;
    const int16_t x1 = 166;
    const int16_t y0 = 146;
    for (uint8_t i = 0; i < DashboardSlotCount; ++i) {
        const int16_t x = (i & 0x01U) ? x1 : x0;
        const int16_t y = (int16_t)(y0 + (i / 2U) * (slotH + 3));
        drawDashboardSlot_(i, x, y, slotW, slotH);
    }

    lastRenderMs_ = now;
    if (force) lastFullRedrawMs_ = now;
    redrawRequested_ = false;
}

uint16_t TFTModuleS3::color_(uint16_t rgb565) const
{
    return displayCfg_.swapColorBytes ? (uint16_t)((rgb565 << 8) | (rgb565 >> 8)) : rgb565;
}

void TFTModuleS3::drawStatusPill_(int16_t x, int16_t y, const char* label, bool ok)
{
    const uint16_t bg = color_(ok ? kGreen : kRed);
    display_.fillRoundRect(x, y, 66, 22, 4, bg);
    display_.setTextSize(1);
    display_.setTextColor(color_(kBlack), bg);
    display_.setCursor(x + 8, y + 7);
    display_.print(label ? label : "");
}

void TFTModuleS3::drawTextLine_(int16_t x, int16_t y, const char* label, const char* value, uint16_t valueColor)
{
    display_.setTextSize(1);
    display_.setTextColor(color_(kMuted), color_(kBlack));
    display_.setCursor(x, y);
    display_.print(label ? label : "");
    display_.setTextColor(valueColor, color_(kBlack));
    display_.setCursor(x + 78, y);
    display_.print(value ? value : "");
}

void TFTModuleS3::drawDashboardSlot_(uint8_t slot, int16_t x, int16_t y, int16_t w, int16_t h)
{
    if (slot >= DashboardSlotCount) return;
    const DashboardSlotConfig& cfg = dashboardCfg_[slot];
    const uint16_t bg = color_(cfg.enabled ? dashboardColor_(cfg.colorId, slot) : kPanel);
    display_.fillRoundRect(x, y, w, h, 3, bg);

    char label[24] = {0};
    slotLabel_(slot, label, sizeof(label));

    char value[28] = {0};
    if (!cfg.enabled || cfg.runtimeUiId == 0U || !runtimeUiAllowed_(cfg.runtimeUiId)) {
        snprintf(value, sizeof(value), "--");
    } else if (!readRuntimeValue_(cfg.runtimeUiId, value, sizeof(value))) {
        snprintf(value, sizeof(value), "--");
    } else {
        const char* unit = runtimeUnit_(cfg.runtimeUiId);
        if (unit && unit[0] != '\0') {
            const size_t n = strnlen(value, sizeof(value));
            if (n + 1U < sizeof(value)) {
                snprintf(value + n, sizeof(value) - n, " %s", unit);
            }
        }
    }

    display_.setTextSize(1);
    display_.setTextColor(color_(kBlack), bg);
    display_.setCursor(x + 5, y + 3);
    display_.print(label);
    display_.setCursor(x + 84, y + 3);
    display_.print(value);
}

void TFTModuleS3::formatIp_(char* out, size_t outLen) const
{
    if (!out || outLen == 0U) return;
    const DataStore* ds = dsSvc_ ? dsSvc_->store : nullptr;
    if (!ds || !networkReady(*ds)) {
        snprintf(out, outLen, "-");
        return;
    }
    const IpV4 ip = networkIp(*ds);
    snprintf(out,
             outLen,
             "%u.%u.%u.%u",
             (unsigned)ip.b[0],
             (unsigned)ip.b[1],
             (unsigned)ip.b[2],
             (unsigned)ip.b[3]);
}

bool TFTModuleS3::readRuntimeValue_(RuntimeUiId runtimeId, char* out, size_t outLen) const
{
    if (!out || outLen == 0U || !runtimeUiAllowed_(runtimeId)) return false;
    const DataStore* ds = dsSvc_ ? dsSvc_->store : nullptr;
    const ModuleId module = (ModuleId)runtimeUiModuleId(runtimeId);
    const uint8_t valueId = runtimeUiValueId(runtimeId);

    switch (module) {
        case ModuleId::Io:
            switch (valueId) {
                case 1: return readIoValue_(PoolBinding::kSensorBindings[PoolBinding::kSensorSlotWaterTemp].ioId, out, outLen);
                case 2: return readIoValue_(PoolBinding::kSensorBindings[PoolBinding::kSensorSlotAirTemp].ioId, out, outLen);
                case 3: return readIoValue_(PoolBinding::kSensorBindings[PoolBinding::kSensorSlotPh].ioId, out, outLen);
                case 4: return readIoValue_(PoolBinding::kSensorBindings[PoolBinding::kSensorSlotOrp].ioId, out, outLen);
                case 5: return readIoValue_(PoolBinding::kSensorBindings[PoolBinding::kSensorSlotWaterCounter].ioId, out, outLen);
                case 6: return readIoValue_(PoolBinding::kSensorBindings[PoolBinding::kSensorSlotPsi].ioId, out, outLen);
                case 7: return readIoBackendValue_(IO_BACKEND_BMP280, 0U, out, outLen);
                case 8: return readIoBackendValue_(IO_BACKEND_BME680, 0U, out, outLen);
                case 9: return readIoBackendValue_(IO_BACKEND_BMP280, 1U, out, outLen);
                case 10: return readIoBackendValue_(IO_BACKEND_SHT40, 0U, out, outLen);
                case 11: return readIoBackendValue_(IO_BACKEND_SHT40, 1U, out, outLen);
                case 12: return readIoBackendValue_(IO_BACKEND_BME680, 1U, out, outLen);
                case 13: return readIoBackendValue_(IO_BACKEND_BME680, 2U, out, outLen);
                case 14: return readIoBackendValue_(IO_BACKEND_BME680, 3U, out, outLen);
                default: return false;
            }

        case ModuleId::Wifi:
            if (!ds) return false;
            if (valueId == 1U) {
                snprintf(out, outLen, "%s", wifiReady(*ds) ? "ON" : "OFF");
                return true;
            }
            if (valueId == 2U) {
                formatIp_(out, outLen);
                return true;
            }
            if (valueId == 3U) {
                if (!WiFi.isConnected()) return false;
                snprintf(out, outLen, "%ld", (long)WiFi.RSSI());
                return true;
            }
            return false;

        case ModuleId::Mqtt:
            if (!ds) return false;
            if (valueId == 1U) {
                snprintf(out, outLen, "%s", mqttReady(*ds) ? "ON" : "OFF");
                return true;
            }
            if (valueId == 3U) {
                snprintf(out, outLen, "%lu", (unsigned long)mqttRxDrop(*ds));
                return true;
            }
            if (valueId == 4U) {
                snprintf(out, outLen, "%lu", (unsigned long)mqttParseFail(*ds));
                return true;
            }
            if (valueId == 5U) {
                snprintf(out, outLen, "%lu", (unsigned long)mqttHandlerFail(*ds));
                return true;
            }
            if (valueId == 6U) {
                snprintf(out, outLen, "%lu", (unsigned long)mqttOversizeDrop(*ds));
                return true;
            }
            return false;

        case ModuleId::System: {
            SystemStatsSnapshot snap{};
            SystemStats::collect(snap);
            if (valueId == 1U) {
                snprintf(out, outLen, "%s", FirmwareVersion::Full);
                return true;
            }
            if (valueId == 2U) {
                snprintf(out, outLen, "%lu", (unsigned long)snap.uptimeMs);
                return true;
            }
            if (valueId == 3U) {
                snprintf(out, outLen, "%lu", (unsigned long)snap.heap.freeBytes);
                return true;
            }
            if (valueId == 4U) {
                snprintf(out, outLen, "%lu", (unsigned long)snap.heap.minFreeBytes);
                return true;
            }
            return false;
        }

        case ModuleId::PoolDevice: {
            if (!ds) return false;
            uint8_t deviceSlot = 0xFFU;
            if (valueId == 1U) deviceSlot = PoolBinding::kDeviceSlotFiltrationPump;
            else if (valueId == 2U) deviceSlot = PoolBinding::kDeviceSlotPhPump;
            else if (valueId == 3U) deviceSlot = PoolBinding::kDeviceSlotChlorinePump;
            else if (valueId == 4U) deviceSlot = PoolBinding::kDeviceSlotRobot;
            else return false;

            PoolDeviceRuntimeStateEntry state{};
            if (!poolDeviceRuntimeState(*ds, deviceSlot, state)) return false;
            snprintf(out, outLen, "%s", state.actualOn ? "ON" : "OFF");
            return true;
        }

        default:
            return false;
    }
}

bool TFTModuleS3::readIoValue_(IoId ioId, char* out, size_t outLen) const
{
    if (!ioSvc_ || !ioSvc_->readValue || !out || outLen == 0U) return false;
    IoValue value{};
    const IoStatus st = ioSvc_->readValue(ioSvc_->ctx, ioId, &value);
    if (st != IO_OK || !value.valid) return false;
    if (value.type == IO_VAL_BOOL) {
        snprintf(out, outLen, "%s", value.v.b ? "ON" : "OFF");
        return true;
    }
    if (value.type == IO_VAL_INT32) {
        snprintf(out, outLen, "%ld", (long)value.v.i32);
        return true;
    }
    snprintf(out, outLen, "%.2f", (double)value.v.f);
    return true;
}

bool TFTModuleS3::readIoBackendValue_(uint8_t backend, uint8_t channel, char* out, size_t outLen) const
{
    if (!ioSvc_ || !ioSvc_->count || !ioSvc_->idAt || !ioSvc_->meta) return false;
    const uint8_t count = ioSvc_->count(ioSvc_->ctx);
    for (uint8_t i = 0; i < count; ++i) {
        IoId id = IO_ID_INVALID;
        if (ioSvc_->idAt(ioSvc_->ctx, i, &id) != IO_OK) continue;
        IoEndpointMeta meta{};
        if (ioSvc_->meta(ioSvc_->ctx, id, &meta) != IO_OK) continue;
        if (meta.backend == backend && meta.channel == channel) {
            return readIoValue_(id, out, outLen);
        }
    }
    return false;
}

const char* TFTModuleS3::runtimeUnit_(RuntimeUiId runtimeId) const
{
    const RuntimeUiManifestItem* item = findRuntimeUiManifestItem(runtimeId);
    return (item && item->unit) ? item->unit : "";
}

void TFTModuleS3::slotLabel_(uint8_t slot, char* out, size_t outLen) const
{
    if (!out || outLen == 0U) return;
    out[0] = '\0';
    if (slot >= DashboardSlotCount) return;
    const DashboardSlotConfig& cfg = dashboardCfg_[slot];
    if (cfg.label[0] != '\0') {
        snprintf(out, outLen, "%s", cfg.label);
        return;
    }

    const RuntimeUiManifestItem* item = findRuntimeUiManifestItem(cfg.runtimeUiId);
    const char* key = (item && item->key) ? item->key : "";
    const char* src = strrchr(key, '.');
    src = src ? (src + 1) : key;
    if (!src || src[0] == '\0') {
        snprintf(out, outLen, "Slot %u", (unsigned)slot);
        return;
    }

    bool upperNext = true;
    size_t j = 0U;
    for (size_t i = 0U; src[i] != '\0' && (j + 1U) < outLen; ++i) {
        char ch = src[i];
        if (ch == '_' || ch == '-') {
            out[j++] = ' ';
            upperNext = true;
            continue;
        }
        if (upperNext && ch >= 'a' && ch <= 'z') ch = (char)(ch - ('a' - 'A'));
        out[j++] = ch;
        upperNext = false;
    }
    out[j] = '\0';
}

uint16_t TFTModuleS3::dashboardColor_(uint8_t colorId, uint8_t slot) const
{
    for (size_t i = 0; i < (sizeof(kDashboardColorPresets) / sizeof(kDashboardColorPresets[0])); ++i) {
        if (kDashboardColorPresets[i].id == colorId) return kDashboardColorPresets[i].rgb565;
    }
    if (slot < DashboardSlotCount) {
        const uint8_t fallbackId = kDashboardDefaultColorIds[slot];
        for (size_t i = 0; i < (sizeof(kDashboardColorPresets) / sizeof(kDashboardColorPresets[0])); ++i) {
            if (kDashboardColorPresets[i].id == fallbackId) return kDashboardColorPresets[i].rgb565;
        }
    }
    return rgb565_(238, 247, 255);
}

bool TFTModuleS3::runtimeUiAllowed_(RuntimeUiId runtimeId)
{
    if (!isValidRuntimeUiId(runtimeId)) return false;
    return findRuntimeUiManifestItem(runtimeId) != nullptr;
}
