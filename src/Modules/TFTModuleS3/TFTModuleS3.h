#pragma once
/**
 * @file TFTModuleS3.h
 * @brief Local TFT module for Waveshare ESP32-S3 builds.
 */

#include <Adafruit_ST7789.h>
#include <SPI.h>

#include "Board/BoardTypes.h"
#include "Core/EventBus/EventBus.h"
#include "Core/Module.h"
#include "Core/RuntimeUi.h"
#include "Core/Services/Services.h"
#include "Modules/Network/MQTTModule/MqttConfigRouteProducer.h"

struct BoardSpec;

class TFTModuleS3 : public Module {
public:
    static constexpr uint8_t DashboardSlotCount = 8;

    explicit TFTModuleS3(const BoardSpec& board);

    ModuleId moduleId() const override { return ModuleId::TftS3; }
    const char* taskName() const override { return "tft.s3"; }
    BaseType_t taskCore() const override { return 1; }
    uint16_t taskStackSize() const override { return 5120; }
    uint8_t taskCount() const override { return 1; }
    const ModuleTaskSpec* taskSpecs() const override { return singleLoopTaskSpec(); }

    uint8_t dependencyCount() const override { return 6; }
    ModuleId dependency(uint8_t i) const override {
        if (i == 0) return ModuleId::LogHub;
        if (i == 1) return ModuleId::ConfigStore;
        if (i == 2) return ModuleId::EventBus;
        if (i == 3) return ModuleId::DataStore;
        if (i == 4) return ModuleId::Wifi;
        if (i == 5) return ModuleId::Mqtt;
        return ModuleId::Unknown;
    }

    void init(ConfigStore& cfg, ServiceRegistry& services) override;
    void onConfigLoaded(ConfigStore&, ServiceRegistry& services) override;
    void loop() override;

private:
    struct ConfigData {
        bool enabled = true;
        bool autoOff60s = true;
        int32_t motionGpio = -1;
    };

    static St7789DisplaySpec displaySpecFromBoard_(const BoardSpec& board);
    static void onEventStatic_(const Event& e, void* user);

    void onEvent_(const Event& e);
    bool beginDisplay_();
    void applyBacklight_(bool on);
    void updateMotionInput_();
    void updateBacklight_();
    void render_(bool force);
    uint16_t color_(uint16_t rgb565) const;
    void drawStatusPill_(int16_t x, int16_t y, const char* label, bool ok);
    void drawTextLine_(int16_t x, int16_t y, const char* label, const char* value, uint16_t valueColor);
    void drawDashboardSlot_(uint8_t slot, int16_t x, int16_t y, int16_t w, int16_t h);
    void formatIp_(char* out, size_t outLen) const;
    bool readRuntimeValue_(RuntimeUiId runtimeId, char* out, size_t outLen) const;
    bool readIoValue_(IoId ioId, char* out, size_t outLen) const;
    bool readIoBackendValue_(uint8_t backend, uint8_t channel, char* out, size_t outLen) const;
    const char* runtimeUnit_(RuntimeUiId runtimeId) const;
    void slotLabel_(uint8_t slot, char* out, size_t outLen) const;
    uint16_t dashboardColor_(uint8_t colorId, uint8_t slot) const;
    static bool runtimeUiAllowed_(RuntimeUiId runtimeId);

    St7789DisplaySpec displayCfg_{};
#if defined(VSPI)
    SPIClass spiBus_{VSPI};
#else
    SPIClass spiBus_{HSPI};
#endif
    Adafruit_ST7789 display_;
    ConfigData cfgData_{};
    ConfigVariable<bool, 0> enabledVar_{
        NVS_KEY("tfts3en"), "enabled", "tft/s3",
        ConfigType::Bool, &cfgData_.enabled, ConfigPersistence::Persistent, 0
    };
    ConfigVariable<bool, 0> autoOffVar_{
        NVS_KEY("tfts3auto"), "auto_off_60s", "tft/s3",
        ConfigType::Bool, &cfgData_.autoOff60s, ConfigPersistence::Persistent, 0
    };
    ConfigVariable<int32_t, 0> motionGpioVar_{
        NVS_KEY("tfts3pir"), "motion_gpio", "tft/s3",
        ConfigType::Int32, &cfgData_.motionGpio, ConfigPersistence::Persistent, 0
    };

    struct DashboardSlotConfig {
        bool enabled = true;
        uint16_t runtimeUiId = 0U;
        char label[24]{};
        uint8_t colorId = 0U;
    };

    DashboardSlotConfig dashboardCfg_[DashboardSlotCount]{};
    ConfigVariable<bool, 0> dashboardEnabledVars_[DashboardSlotCount]{};
    ConfigVariable<uint16_t, 0> dashboardRuntimeIdVars_[DashboardSlotCount]{};
    ConfigVariable<char, 0> dashboardLabelVars_[DashboardSlotCount]{};
    ConfigVariable<uint8_t, 0> dashboardColorIdVars_[DashboardSlotCount]{};
    char dashboardModuleNames_[DashboardSlotCount][24]{};
    char dashboardEnabledKeys_[DashboardSlotCount][16]{};
    char dashboardRuntimeIdKeys_[DashboardSlotCount][16]{};
    char dashboardLabelKeys_[DashboardSlotCount][16]{};
    char dashboardColorIdKeys_[DashboardSlotCount][16]{};
    MqttConfigRouteProducer::Route cfgRoutes_[1U + DashboardSlotCount]{};

    const IOServiceV2* ioSvc_ = nullptr;
    const DataStoreService* dsSvc_ = nullptr;
    EventBus* eventBus_ = nullptr;
    MqttConfigRouteProducer cfgMqttPub_{};
    bool cfgMqttPubConfigured_ = false;
    bool displayReady_ = false;
    bool redrawRequested_ = true;
    bool backlightOn_ = false;
    bool motionInputConfigured_ = false;
    int32_t appliedMotionGpio_ = -1;
    bool pirRawState_ = false;
    bool pirStableState_ = false;
    uint32_t pirDebounceChangedAtMs_ = 0;
    uint32_t pirDebounceMs_ = 120;
    bool pirActiveHigh_ = true;
    uint32_t lastMotionMs_ = 0;
    uint32_t lastRenderMs_ = 0;
    uint32_t lastFullRedrawMs_ = 0;
};
