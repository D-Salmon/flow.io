/**
 * @file Ws2812StatusLedDriver.cpp
 * @brief Implementation for single-LED WS2812 status output.
 */

#include "Modules/HMIModule/Drivers/Ws2812StatusLedDriver.h"

#include <Arduino.h>
#include <esp_arduino_version.h>
#include <esp32-hal-rgb-led.h>
#include <string.h>

void Ws2812StatusLedDriver::setConfig(const Config& cfg)
{
    cfg_ = cfg;
    ready_ = false;
    lastWriteValid_ = false;
}

bool Ws2812StatusLedDriver::begin()
{
    if (!cfg_.enabled || cfg_.gpio < 0) {
        ready_ = false;
        return false;
    }
    if (!digitalPinIsValid((uint8_t)cfg_.gpio)) {
        ready_ = false;
        return false;
    }

    pinMode((uint8_t)cfg_.gpio, OUTPUT);
    blinkPhaseOn_ = true;
    blinkPhaseSinceMs_ = millis();
    breatheSinceMs_ = blinkPhaseSinceMs_;
    ready_ = true;
    applyOutput_(true);
    return true;
}

void Ws2812StatusLedDriver::tick(uint32_t nowMs)
{
    if (!ready_) return;

    if (!state_.enabled || (!state_.blinkEnabled && !state_.breatheEnabled)) {
        if (!blinkPhaseOn_) {
            blinkPhaseOn_ = true;
            blinkPhaseSinceMs_ = nowMs;
            applyOutput_(true);
        } else {
            applyOutput_(false);
        }
        return;
    }
    if (state_.breatheEnabled) {
        applyOutput_(false);
        return;
    }

    const uint16_t phaseMs = blinkPhaseOn_ ? state_.blinkOnMs : state_.blinkOffMs;
    if ((uint32_t)(nowMs - blinkPhaseSinceMs_) >= (uint32_t)phaseMs) {
        blinkPhaseOn_ = !blinkPhaseOn_;
        blinkPhaseSinceMs_ = nowMs;
        applyOutput_(true);
    } else {
        applyOutput_(false);
    }
}

bool Ws2812StatusLedDriver::setState(const Ws2812StatusLedState& state)
{
    Ws2812StatusLedState normalized = state;
    sanitizeState_(normalized);

    const bool changed = memcmp(&state_, &normalized, sizeof(Ws2812StatusLedState)) != 0;
    state_ = normalized;
    if (state_.blinkEnabled) {
        blinkPhaseOn_ = true;
        blinkPhaseSinceMs_ = millis();
    }
    if (state_.breatheEnabled) {
        breatheSinceMs_ = millis();
    }
    if (changed) applyOutput_(true);
    return true;
}

bool Ws2812StatusLedDriver::getState(Ws2812StatusLedState& out) const
{
    out = state_;
    return true;
}

bool Ws2812StatusLedDriver::setEnabled(bool enabled)
{
    if (state_.enabled == enabled) return true;
    state_.enabled = enabled;
    applyOutput_(true);
    return true;
}

bool Ws2812StatusLedDriver::setColor(uint8_t red, uint8_t green, uint8_t blue)
{
    if (state_.red == red && state_.green == green && state_.blue == blue) return true;
    state_.red = red;
    state_.green = green;
    state_.blue = blue;
    applyOutput_(true);
    return true;
}

bool Ws2812StatusLedDriver::setBrightness(uint8_t brightness)
{
    if (state_.brightness == brightness) return true;
    state_.brightness = brightness;
    applyOutput_(true);
    return true;
}

bool Ws2812StatusLedDriver::setBlink(bool enabled, uint16_t onMs, uint16_t offMs)
{
    if (enabled) {
        if (onMs == 0U) onMs = 250U;
        if (offMs == 0U) offMs = 250U;
    }

    if (state_.blinkEnabled == enabled &&
        state_.blinkOnMs == onMs &&
        state_.blinkOffMs == offMs) {
        return true;
    }

    state_.blinkEnabled = enabled;
    if (enabled) state_.breatheEnabled = false;
    state_.blinkOnMs = onMs;
    state_.blinkOffMs = offMs;
    blinkPhaseOn_ = true;
    blinkPhaseSinceMs_ = millis();
    applyOutput_(true);
    return true;
}

bool Ws2812StatusLedDriver::setBreathe(bool enabled, uint16_t periodMs)
{
    if (enabled && periodMs < 200U) periodMs = 200U;
    if (state_.breatheEnabled == enabled && state_.breathePeriodMs == periodMs) {
        return true;
    }

    state_.breatheEnabled = enabled;
    if (enabled) state_.blinkEnabled = false;
    state_.breathePeriodMs = periodMs;
    breatheSinceMs_ = millis();
    applyOutput_(true);
    return true;
}

void Ws2812StatusLedDriver::sanitizeState_(Ws2812StatusLedState& state) const
{
    if (state.blinkEnabled) {
        state.breatheEnabled = false;
        if (state.blinkOnMs == 0U) state.blinkOnMs = 250U;
        if (state.blinkOffMs == 0U) state.blinkOffMs = 250U;
    }
    if (state.breatheEnabled && state.breathePeriodMs < 200U) {
        state.breathePeriodMs = 200U;
    }
}

void Ws2812StatusLedDriver::applyOutput_(bool force)
{
    if (!ready_) return;

    uint8_t outR = 0U;
    uint8_t outG = 0U;
    uint8_t outB = 0U;
    const bool outputEnabled = state_.enabled && (!state_.blinkEnabled || blinkPhaseOn_);
    if (outputEnabled) {
        uint8_t brightness = state_.brightness;
        if (state_.breatheEnabled) {
            const uint16_t period = (state_.breathePeriodMs < 200U) ? 200U : state_.breathePeriodMs;
            const uint16_t phase = (uint16_t)((millis() - breatheSinceMs_) % period);
            const uint16_t half = (uint16_t)(period / 2U);
            const uint16_t ramp = (phase < half) ? phase : (uint16_t)(period - phase);
            const uint8_t minBrightness = 12U;
            const uint16_t span = (brightness > minBrightness) ? (uint16_t)(brightness - minBrightness) : 0U;
            brightness = (uint8_t)(minBrightness + ((span * ramp) / (half == 0U ? 1U : half)));
        }
        outR = (uint8_t)(((uint16_t)state_.red * (uint16_t)brightness + 127U) / 255U);
        outG = (uint8_t)(((uint16_t)state_.green * (uint16_t)brightness + 127U) / 255U);
        outB = (uint8_t)(((uint16_t)state_.blue * (uint16_t)brightness + 127U) / 255U);
    }

    if (!force &&
        lastWriteValid_ &&
        lastWriteR_ == outR &&
        lastWriteG_ == outG &&
        lastWriteB_ == outB) {
        return;
    }

#if ESP_ARDUINO_VERSION_MAJOR >= 3
    rgbLedWriteOrdered((uint8_t)cfg_.gpio, LED_COLOR_ORDER_RGB, outR, outG, outB);
#else
    neopixelWrite((uint8_t)cfg_.gpio, outG, outR, outB);
#endif
    lastWriteR_ = outR;
    lastWriteG_ = outG;
    lastWriteB_ = outB;
    lastWriteValid_ = true;
}
