#include <unity.h>
#include "Modules/Network/FirmwareUpdateModule/FirmwareUpdateReceipt.h"

// PlatformIO excludes src/ from unit-test builds in this project.
#include "../../src/Modules/Network/FirmwareUpdateModule/FirmwareUpdateReceipt.cpp"

void setUp() {}
void tearDown() {}

void test_receipt_round_trip_and_tamper_detection()
{
    FirmwareUpdateReceipt receipt = makeFirmwareUpdateReceipt(
        FirmwareUpdateTarget::Nextion, 42U, FirmwareUpdateReceiptState::Running);
    TEST_ASSERT_TRUE(firmwareUpdateReceiptIsValid(receipt));
    receipt.operationId = 43U;
    TEST_ASSERT_FALSE(firmwareUpdateReceiptIsValid(receipt));
}

void test_reboot_pending_becomes_succeeded()
{
    FirmwareUpdateReceipt receipt = makeFirmwareUpdateReceipt(
        FirmwareUpdateTarget::Waveshare, 100U, FirmwareUpdateReceiptState::RebootPending);
    TEST_ASSERT_TRUE(finalizeFirmwareUpdateReceiptAfterBoot(&receipt));
    TEST_ASSERT_EQUAL_UINT8((uint8_t)FirmwareUpdateReceiptState::Succeeded, (uint8_t)receipt.state);
}

void test_running_becomes_interrupted()
{
    FirmwareUpdateReceipt receipt = makeFirmwareUpdateReceipt(
        FirmwareUpdateTarget::Spiffs, 101U, FirmwareUpdateReceiptState::Running);
    TEST_ASSERT_TRUE(finalizeFirmwareUpdateReceiptAfterBoot(&receipt));
    TEST_ASSERT_EQUAL_UINT8((uint8_t)FirmwareUpdateReceiptState::Interrupted, (uint8_t)receipt.state);
}

void setup()
{
    UNITY_BEGIN();
    RUN_TEST(test_receipt_round_trip_and_tamper_detection);
    RUN_TEST(test_reboot_pending_becomes_succeeded);
    RUN_TEST(test_running_becomes_interrupted);
    UNITY_END();
}

void loop() {}
