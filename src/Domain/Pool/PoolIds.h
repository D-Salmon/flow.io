#pragma once

#include "Domain/DomainTypes.h"

namespace PoolIds {

enum DomainSlot : DomainSlotId {
    SensorOrp = 1,
    SensorPh = 2,
    SensorPsi = 3,
    SensorSpareAnalog = 4,
    SensorWaterTemp = 5,
    SensorAirTemp = 6,
    SensorPoolLevel = 7,
    SensorPhLevel = 8,
    SensorChlorineLevel = 9,
    SensorWaterCounter = 10,
    ActuatorFiltrationPump = 11,
    ActuatorPhPump = 12,
    ActuatorChlorinePump = 13,
    ActuatorRobot = 14,
    ActuatorFillPump = 15,
    ActuatorChlorineGenerator = 16,
    ActuatorLights = 17,
    ActuatorWaterHeater = 18,
    SensorFlowSwitch = 19,
    SensorFiltrationContactorFeedback = 20,
    SensorSwgContactorFeedback = 21
};

enum Device : PoolDeviceId {
    DeviceFiltrationPump = 0,
    DevicePhPump = 1,
    DeviceChlorinePump = 2,
    DeviceRobot = 3,
    DeviceFillPump = 4,
    DeviceChlorineGenerator = 5,
    DeviceLights = 6,
    DeviceWaterHeater = 7
};

constexpr uint8_t DeviceCount = 8;
constexpr uint8_t SensorCount = 11;
constexpr uint8_t DomainSlotCount = 21;

}  // namespace PoolIds
