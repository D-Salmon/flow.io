/**
 * @file Tca9554Driver.cpp
 * @brief Implementation file.
 */

#include "Tca9554Driver.h"

Tca9554Driver::Tca9554Driver(const char* driverId, I2CBus* bus, uint8_t address)
    : driverId_(driverId), bus_(bus), address_(address)
{
}

bool Tca9554Driver::begin()
{
    // Safe startup mode:
    // - disable polarity inversion,
    // - preload output latch to 0x00 while pins are still inputs,
    // - switch all pins to outputs.
    // This prevents relay activation when mains power is applied.
    if (!writeReg_(kRegPolarityInversion, 0x00)) return false;
    if (!writeReg_(kRegOutputPort, 0x00)) return false;
    if (!writeReg_(kRegConfiguration, 0x00)) return false;
    state_ = 0x00;
    stateKnown_ = true;
    return true;
}

bool Tca9554Driver::writeMask(uint8_t mask)
{
    state_ = mask;
    if (!writeReg_(kRegOutputPort, state_)) return false;
    stateKnown_ = true;
    return true;
}

bool Tca9554Driver::readMask(uint8_t& mask) const
{
    if (!stateKnown_) return false;
    mask = state_;
    return true;
}

bool Tca9554Driver::writePin(uint8_t pin, bool on)
{
    if (pin > 7) return false;
    if (!ensureStateSynced_()) return false;

    if (on) state_ |= (uint8_t)(1u << pin);
    else state_ &= (uint8_t)~(1u << pin);

    if (!writeReg_(kRegOutputPort, state_)) return false;
    stateKnown_ = true;
    return true;
}

bool Tca9554Driver::readShadow(uint8_t pin, bool& on) const
{
    if (pin > 7) return false;
    if (!stateKnown_) return false;
    on = (state_ & (uint8_t)(1u << pin)) != 0;
    return true;
}

bool Tca9554Driver::writeReg_(uint8_t reg, uint8_t value)
{
    if (!bus_) return false;
    if (!bus_->lock(20)) return false;
    const bool ok = bus_->writeReg(address_, reg, &value, 1);
    bus_->unlock();
    return ok;
}

bool Tca9554Driver::readReg_(uint8_t reg, uint8_t& value) const
{
    if (!bus_) return false;
    if (!bus_->lock(20)) return false;
    bool ok = bus_->readReg(address_, reg, &value, 1);
    bus_->unlock();
    return ok;
}

bool Tca9554Driver::ensureStateSynced_()
{
    if (stateKnown_) return true;
    uint8_t latched = 0x00;
    if (!readReg_(kRegOutputPort, latched)) return false;
    state_ = latched;
    stateKnown_ = true;
    return true;
}
