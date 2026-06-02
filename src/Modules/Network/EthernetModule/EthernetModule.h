#pragma once
/**
 * @file EthernetModule.h
 * @brief W5500 Ethernet connectivity module (DHCP).
 */

#include "Core/Module.h"
#include "Core/NvsKeys.h"
#include "Core/ServiceBinding.h"
#include "Core/Services/Services.h"
#include "Board/BoardTypes.h"

#include <ETH.h>
#include <ESPmDNS.h>
#include <NetworkEvents.h>

enum class EthernetState : uint8_t {
    Disabled = 0,
    Starting,
    WaitingIp,
    Connected,
    ErrorWait
};

struct EthernetConfig {
    bool enabled = false;
};

class EthernetModule : public Module {
public:
    EthernetModule() = default;
    explicit EthernetModule(const BoardSpec& board);

    ModuleId moduleId() const override { return ModuleId::Ethernet; }
    const char* taskName() const override { return "ethernet"; }
    BaseType_t taskCore() const override { return 0; }
    uint16_t taskStackSize() const override { return 3584; }
    uint8_t taskCount() const override { return 1; }
    const ModuleTaskSpec* taskSpecs() const override { return singleLoopTaskSpec(); }

    uint8_t dependencyCount() const override { return 2; }
    ModuleId dependency(uint8_t i) const override {
        if (i == 0) return ModuleId::LogHub;
        if (i == 1) return ModuleId::DataStore;
        return ModuleId::Unknown;
    }

    void init(ConfigStore& cfg, ServiceRegistry& services) override;
    void onConfigLoaded(ConfigStore& cfg, ServiceRegistry& services) override;
    void loop() override;

private:
    static constexpr uint32_t kErrorRetryMs = 3000U;

    EthernetConfig cfgData_{};
    EthernetState state_ = EthernetState::Disabled;
    uint32_t stateTs_ = 0U;
    bool serviceRegistered_ = false;

    DataStore* dataStore_ = nullptr;
    ServiceRegistry* services_ = nullptr;

    bool driverStarted_ = false;
    bool spiStarted_ = false;
    bool mdnsStarted_ = false;
    uint8_t spiFreqMhz_ = 8;
    network_event_handle_t networkEventHandle_ = 0;
    uint32_t startAttempts_ = 0U;
    uint32_t consecutiveStartFailures_ = 0U;
    const char* lastStartFailureStage_ = "none";
    int lastStartFailureErr_ = 0;
    EthernetW5500Spec ethCfg_{};
    bool hasEthPins_ = false;

    volatile bool linkUp_ = false;
    volatile bool gotIp_ = false;
    volatile bool ipDirty_ = false;
    volatile bool linkDirty_ = false;
    volatile uint32_t ipAddr_ = 0U;

    ConfigVariable<bool,0> enabledVar_{
        NVS_KEY(NvsKeys::Ethernet::Enabled), "enabled", "ethernet",
        ConfigType::Bool, &cfgData_.enabled, ConfigPersistence::Persistent, 0
    };

    static void onNetworkEventStatic_(arduino_event_t* event);
    void onNetworkEvent_(arduino_event_t* event);

    void setState_(EthernetState next);
    void resetRuntimeState_();
    bool ensureDriverStarted_();
    bool installDriver_();
    void cleanupDriver_();
    void noteStartFailure_(const char* stage, int err);
    void logEthLinkInfo_() const;
    void startMdns_();
    void stopMdns_();
    void syncRuntimeState_();

    bool isWebReachable_() const;
    NetworkAccessMode mode_() const;
    bool getIp_(char* out, size_t len) const;
    bool notifyWifiConfigChanged_();

    NetworkAccessService netAccessSvc_{
        ServiceBinding::bind<&EthernetModule::isWebReachable_>,
        ServiceBinding::bind<&EthernetModule::mode_>,
        ServiceBinding::bind<&EthernetModule::getIp_>,
        ServiceBinding::bind<&EthernetModule::notifyWifiConfigChanged_>,
        this
    };
};
