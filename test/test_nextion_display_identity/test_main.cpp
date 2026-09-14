#include <unity.h>
#include "Modules/HMIModule/Drivers/NextionDisplayIdentity.h"
#include <string.h>

// PlatformIO excludes src/ from unit-test builds in this project.
#include "../../src/Modules/HMIModule/Drivers/NextionDisplayIdentity.cpp"

void setUp() {}
void tearDown() {}

void test_connect_response_extracts_resistive_model()
{
    HmiDisplayIdentity identity{};
    TEST_ASSERT_TRUE(parseNextionConnectResponse(
        "comok 1,38024-0,NX8048P050_011R,99,61488,D264B8204F0E1828,16777216", identity));
    TEST_ASSERT_EQUAL_STRING("NX8048P050_011R", identity.model);
    TEST_ASSERT_EQUAL_STRING("NX8048P050_011", identity.compatibility);
    TEST_ASSERT_EQUAL_UINT16(99U, identity.deviceFirmwareVersion);
}

void test_touch_variants_share_compatibility()
{
    HmiDisplayIdentity resistive{};
    HmiDisplayIdentity capacitive{};
    TEST_ASSERT_TRUE(parseNextionDisplayModel("NX8048P050-011R", resistive));
    TEST_ASSERT_TRUE(parseNextionDisplayModel("nx8048p050_011c", capacitive));
    TEST_ASSERT_EQUAL_STRING(resistive.compatibility, capacitive.compatibility);
}

void test_variant_suffix_is_preserved()
{
    HmiDisplayIdentity identity{};
    TEST_ASSERT_TRUE(parseNextionDisplayModel("NX4827P043-011R-Y", identity));
    TEST_ASSERT_EQUAL_STRING("NX4827P043_011_Y", identity.compatibility);
}

void test_no_touch_model_remains_distinct()
{
    HmiDisplayIdentity identity{};
    TEST_ASSERT_TRUE(parseNextionDisplayModel("NX4832K035_011N", identity));
    TEST_ASSERT_EQUAL_STRING("NX4832K035_011N", identity.compatibility);
}

void test_artifact_filename_and_versions()
{
    char compatibility[HMI_DISPLAY_MODEL_TEXT_MAX]{};
    char version[HMI_DISPLAY_VERSION_TEXT_MAX]{};
    TEST_ASSERT_TRUE(parseNextionArtifactFilename(
        "FlowIO_Nextion_NX8048P070_011-6.0.0.tft",
        compatibility, sizeof(compatibility), version, sizeof(version)));
    TEST_ASSERT_EQUAL_STRING("NX8048P070_011", compatibility);
    TEST_ASSERT_EQUAL_STRING("6.0.0", version);
    TEST_ASSERT_EQUAL_INT(-1, compareNextionVersions("6.0.9", "6.1.0"));
    TEST_ASSERT_EQUAL_INT(1, compareNextionVersions("10.0.0", "6.9.9"));
}

void test_touch_specific_artifact_is_rejected()
{
    char compatibility[HMI_DISPLAY_MODEL_TEXT_MAX]{};
    char version[HMI_DISPLAY_VERSION_TEXT_MAX]{};
    TEST_ASSERT_FALSE(parseNextionArtifactFilename(
        "FlowIO_Nextion_NX8048P070_011C-6.0.0.tft",
        compatibility, sizeof(compatibility), version, sizeof(version)));
}

void setup()
{
    UNITY_BEGIN();
    RUN_TEST(test_connect_response_extracts_resistive_model);
    RUN_TEST(test_touch_variants_share_compatibility);
    RUN_TEST(test_variant_suffix_is_preserved);
    RUN_TEST(test_no_touch_model_remains_distinct);
    RUN_TEST(test_artifact_filename_and_versions);
    RUN_TEST(test_touch_specific_artifact_is_rejected);
    UNITY_END();
}

void loop() {}
