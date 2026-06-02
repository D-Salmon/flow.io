#include "Modules/Network/EthernetModule/EthernetModule.h"

#include "Core/EventBus/EventPayloads.h"
#define LOG_MODULE_ID ((LogModuleId)LogModuleIdValue::EthernetModule)
#include "Core/ModuleLog.h"
#include "Board/BoardSpec.h"
#include "Modules/Network/WifiModule/WifiRuntime.h"

#include <Arduino.h>
#include <SPI.h>
#include <esp_err.h>
#include <esp_netif_ip_addr.h>

namespace {
const char* stateName(EthernetState s)
{
    switch (s) {
        case EthernetState::Disabled: return "Disabled";
        case EthernetState::Starting: return "Starting";
        case EthernetState::WaitingIp: return "WaitingIp";
        case EthernetState::Connected: return "Connected";
        case EthernetState::ErrorWait: return "ErrorWait";
        default: return "Unknown";
    }
}

EthernetModule* gEthernetInstance = nullptr;

uint8_t toSpiFreqMhz_(uint32_t hz)
{
    if (hz == 0U) return 8U;
    uint32_t mhz = (hz + 500000U) / 1000000U;
    if (mhz < 1U) mhz = 1U;
    if (mhz > 80U) mhz = 80U;
    return (uint8_t)mhz;
}
}  // namespace

EthernetModule::EthernetModule(const BoardSpec& board)
{
    const EthernetW5500Spec* eth = boardEthernetW5500(board);
    if (eth) {
        ethCfg_ = *eth;
        hasEthPins_ = ethCfg_.enabled &&
                      ethCfg_.mosiPin >= 0 &&
                      ethCfg_.misoPin >= 0 &&
                      ethCfg_.sclkPin >= 0 &&
                      ethCfg_.csPin >= 0 &&
                      ethCfg_.intPin >= 0 &&
                      ethCfg_.rstPin >= 0;
        spiFreqMhz_ = toSpiFreqMhz_(ethCfg_.spiClockHz);
    }
}

void EthernetModule::init(ConfigStore& cfg, ServiceRegistry& services)
{
    constexpr uint8_t kCfgModuleId = (uint8_t)ConfigModuleId::Ethernet;
    constexpr uint8_t kCfgBranchId = 1U;
    cfg.registerVar(enabledVar_, kCfgModuleId, kCfgBranchId);

    services_ = &services;
    const DataStoreService* dsSvc = services.get<DataStoreService>(ServiceId::DataStore);
    dataStore_ = dsSvc ? dsSvc->store : nullptr;

    gEthernetInstance = this;
    cleanupDriver_();
    setState_(EthernetState::Disabled);
    resetRuntimeState_();
}

void EthernetModule::onConfigLoaded(ConfigStore&, ServiceRegistry& services)
{
    if (cfgData_.enabled) {
        if (!hasEthPins_) {
            LOGE("ethernet enabled in config but board has no valid W5500 pin mapping");
            setState_(EthernetState::ErrorWait);
            return;
        }
        if (!services.has(ServiceId::NetworkAccess)) {
            if (services.add(ServiceId::NetworkAccess, &netAccessSvc_)) {
                serviceRegistered_ = true;
            } else {
                LOGE("service registration failed: %s", toString(ServiceId::NetworkAccess));
            }
        }
        setState_(EthernetState::Starting);
        LOGI("Ethernet enabled (W5500 DHCP via ETH.begin)");
    } else {
        cleanupDriver_();
        resetRuntimeState_();
        setState_(EthernetState::Disabled);
        LOGI("Ethernet disabled");
    }
}

void EthernetModule::loop()
{
    if (cfgData_.enabled || driverStarted_) {
        syncRuntimeState_();
    }

    switch (state_) {
        case EthernetState::Disabled:
            vTaskDelay(pdMS_TO_TICKS(300));
            break;

        case EthernetState::Starting:
            if (ensureDriverStarted_()) {
                setState_(EthernetState::WaitingIp);
            } else {
                setState_(EthernetState::ErrorWait);
            }
            vTaskDelay(pdMS_TO_TICKS(80));
            break;

        case EthernetState::WaitingIp:
            if (gotIp_) {
                setState_(EthernetState::Connected);
            }
            vTaskDelay(pdMS_TO_TICKS(120));
            break;

        case EthernetState::Connected:
            if (!gotIp_) {
                setState_(EthernetState::WaitingIp);
            }
            vTaskDelay(pdMS_TO_TICKS(150));
            break;

        case EthernetState::ErrorWait:
            if ((millis() - stateTs_) >= kErrorRetryMs) {
                LOGW("Retrying Ethernet start (attempt=%lu, consecutive_failures=%lu, last_stage=%s, last_err=%d:%s)",
                     (unsigned long)startAttempts_,
                     (unsigned long)consecutiveStartFailures_,
                     lastStartFailureStage_ ? lastStartFailureStage_ : "none",
                     lastStartFailureErr_,
                     esp_err_to_name((esp_err_t)lastStartFailureErr_));
                setState_(EthernetState::Starting);
            }
            vTaskDelay(pdMS_TO_TICKS(200));
            break;
    }
}

void EthernetModule::onNetworkEventStatic_(arduino_event_t* event)
{
    if (!event) return;
    EthernetModule* self = gEthernetInstance;
    if (!self) return;
    self->onNetworkEvent_(event);
}

void EthernetModule::onNetworkEvent_(arduino_event_t* event)
{
    if (!event) return;

    switch (event->event_id) {
        case ARDUINO_EVENT_ETH_START:
            LOGI("ETH event: started");
            (void)ETH.setHostname("flowio-eth0");
            break;

        case ARDUINO_EVENT_ETH_CONNECTED:
            linkUp_ = true;
            linkDirty_ = true;
            LOGI("ETH link up");
            logEthLinkInfo_();
            break;

        case ARDUINO_EVENT_ETH_GOT_IP: {
            const ip_event_got_ip_t* got = &event->event_info.got_ip;
            ipAddr_ = got->ip_info.ip.addr;
            gotIp_ = true;
            ipDirty_ = true;
            linkUp_ = true;
            linkDirty_ = true;
            LOGI("ETH got IP " IPSTR, IP2STR(&got->ip_info.ip));
            startMdns_();
            break;
        }

        case ARDUINO_EVENT_ETH_LOST_IP:
            gotIp_ = false;
            ipAddr_ = 0U;
            ipDirty_ = true;
            LOGW("ETH lost IP");
            stopMdns_();
            break;

        case ARDUINO_EVENT_ETH_DISCONNECTED:
            linkUp_ = false;
            gotIp_ = false;
            ipAddr_ = 0U;
            linkDirty_ = true;
            ipDirty_ = true;
            LOGW("ETH link down");
            stopMdns_();
            break;

        case ARDUINO_EVENT_ETH_STOP:
            linkUp_ = false;
            gotIp_ = false;
            ipAddr_ = 0U;
            linkDirty_ = true;
            ipDirty_ = true;
            LOGI("ETH event: stopped");
            stopMdns_();
            break;

        default:
            break;
    }
}

void EthernetModule::setState_(EthernetState next)
{
    if (state_ == next) return;
    state_ = next;
    stateTs_ = millis();
    LOGD("state=%s", stateName(state_));
}

void EthernetModule::resetRuntimeState_()
{
    linkUp_ = false;
    gotIp_ = false;
    ipAddr_ = 0U;
    ipDirty_ = true;
    linkDirty_ = true;
    if (dataStore_) {
        setNetworkIp(*dataStore_, IpV4{});
        setNetworkReady(*dataStore_, false);
    }
}

bool EthernetModule::installDriver_()
{
    cleanupDriver_();
    ++startAttempts_;

    LOGI("ETH begin attempt=%lu phy=%d phy_addr=%u spi_clk=%luHz mosi=%d miso=%d sclk=%d cs=%d irq=%d rst=%d",
         (unsigned long)startAttempts_,
         (int)ETH_PHY_W5500,
         (unsigned)ethCfg_.phyAddr,
         (unsigned long)ethCfg_.spiClockHz,
         (int)ethCfg_.mosiPin,
         (int)ethCfg_.misoPin,
         (int)ethCfg_.sclkPin,
         (int)ethCfg_.csPin,
         (int)ethCfg_.intPin,
         (int)ethCfg_.rstPin);

    if (networkEventHandle_ == 0) {
        networkEventHandle_ = Network.onEvent(EthernetModule::onNetworkEventStatic_);
    }

    SPI.begin(ethCfg_.sclkPin, ethCfg_.misoPin, ethCfg_.mosiPin);
    spiStarted_ = true;

    const bool ok = ETH.begin(ETH_PHY_W5500,
                              (int32_t)ethCfg_.phyAddr,
                              ethCfg_.csPin,
                              ethCfg_.intPin,
                              ethCfg_.rstPin,
                              SPI,
                              spiFreqMhz_);
    if (!ok) {
        noteStartFailure_("ETH.begin", (int)ESP_FAIL);
        cleanupDriver_();
        return false;
    }

    driverStarted_ = true;
    consecutiveStartFailures_ = 0U;
    lastStartFailureStage_ = "none";
    lastStartFailureErr_ = ESP_OK;

    const String mac = ETH.macAddress();
    LOGI("Ethernet driver started freq_mhz=%u mac=%s", (unsigned)spiFreqMhz_, mac.c_str());
    return true;
}

bool EthernetModule::ensureDriverStarted_()
{
    if (!hasEthPins_) {
        noteStartFailure_("invalid_board_pin_mapping", (int)ESP_ERR_INVALID_ARG);
        return false;
    }
    if (driverStarted_) return true;
    return installDriver_();
}

void EthernetModule::cleanupDriver_()
{
    stopMdns_();

    if (networkEventHandle_ != 0) {
        Network.removeEvent(networkEventHandle_);
        networkEventHandle_ = 0;
    }

    if (driverStarted_) {
        ETH.end();
    }

    driverStarted_ = false;
    spiStarted_ = false;
}

void EthernetModule::noteStartFailure_(const char* stage, int err)
{
    ++consecutiveStartFailures_;
    lastStartFailureStage_ = stage ? stage : "unknown";
    lastStartFailureErr_ = err;
    LOGE("ETH start failed stage=%s err=%d:%s consecutive_failures=%lu",
         lastStartFailureStage_,
         lastStartFailureErr_,
         esp_err_to_name((esp_err_t)lastStartFailureErr_),
         (unsigned long)consecutiveStartFailures_);
}

void EthernetModule::logEthLinkInfo_() const
{
    const String mac = ETH.macAddress();
    LOGI("ETH hwaddr=%s", mac.c_str());
    LOGI("ETH speed=%uM", (unsigned)ETH.linkSpeed());
    LOGI("ETH duplex=%s", ETH.fullDuplex() ? "full" : "half");
}

void EthernetModule::startMdns_()
{
    if (mdnsStarted_) return;
    if (!gotIp_) return;

    if (!MDNS.begin("flowio")) {
        LOGW("mDNS start failed host=flowio on Ethernet");
        return;
    }
    mdnsStarted_ = true;
    LOGI("mDNS started host=flowio.local (Ethernet)");
}

void EthernetModule::stopMdns_()
{
    if (!mdnsStarted_) return;
    MDNS.end();
    mdnsStarted_ = false;
    LOGI("mDNS stopped (Ethernet)");
}

void EthernetModule::syncRuntimeState_()
{
    if (!dataStore_) return;

    if (ipDirty_) {
        ipDirty_ = false;
        IpV4 ip{};
        const esp_ip4_addr_t ip4 = {ipAddr_};
        ip.b[0] = (uint8_t)esp_ip4_addr1_16(&ip4);
        ip.b[1] = (uint8_t)esp_ip4_addr2_16(&ip4);
        ip.b[2] = (uint8_t)esp_ip4_addr3_16(&ip4);
        ip.b[3] = (uint8_t)esp_ip4_addr4_16(&ip4);
        setNetworkIp(*dataStore_, ip);
    }

    if (linkDirty_) {
        linkDirty_ = false;
    }
    setNetworkReady(*dataStore_, gotIp_);
}

bool EthernetModule::isWebReachable_() const
{
    return gotIp_;
}

NetworkAccessMode EthernetModule::mode_() const
{
    return gotIp_ ? NetworkAccessMode::Station : NetworkAccessMode::None;
}

bool EthernetModule::getIp_(char* out, size_t len) const
{
    if (!out || len == 0) return false;
    out[0] = '\0';
    if (!gotIp_) return false;

    const esp_ip4_addr_t ip = {ipAddr_};
    snprintf(out, len, IPSTR, IP2STR(&ip));
    return out[0] != '\0';
}

bool EthernetModule::notifyWifiConfigChanged_()
{
    return false;
}
