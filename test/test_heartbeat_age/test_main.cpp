#include <unity.h>
#include "Core/HeartbeatAge.h"
void setUp() {}
void tearDown() {}
void test_future_snapshot_is_fresh() {
    TEST_ASSERT_EQUAL_UINT32(0, HeartbeatAge::elapsed(100, 102));
    TEST_ASSERT_EQUAL_UINT32(0, HeartbeatAge::elapsed(100, 101));
}
void test_missing_and_stale_heartbeats() {
    TEST_ASSERT_EQUAL_UINT32(UINT32_MAX, HeartbeatAge::elapsed(100, 0));
    TEST_ASSERT_EQUAL_UINT32(6000, HeartbeatAge::elapsed(7000, 1000));
    TEST_ASSERT_EQUAL_UINT32(5000, HeartbeatAge::elapsed(6000, 1000));
    TEST_ASSERT_EQUAL_UINT32(0, HeartbeatAge::elapsed(100, 100));
}
void test_wrap_and_client_recency() {
    TEST_ASSERT_EQUAL_UINT32(32, HeartbeatAge::elapsed(16, 0xfffffff0U));
    TEST_ASSERT_EQUAL_UINT32(8, HeartbeatAge::mostRecentAge(16, 0xfffffff0U, 8));
    TEST_ASSERT_EQUAL_UINT32(8, HeartbeatAge::mostRecentAge(16, 8, 0xfffffff0U));
    TEST_ASSERT_EQUAL_UINT32(8, HeartbeatAge::mostRecentAge(16, 0, 8));
    TEST_ASSERT_EQUAL_UINT32(UINT32_MAX, HeartbeatAge::mostRecentAge(16, 0, 0));
}
int main() {
    UNITY_BEGIN();
    RUN_TEST(test_future_snapshot_is_fresh);
    RUN_TEST(test_missing_and_stale_heartbeats);
    RUN_TEST(test_wrap_and_client_recency);
    return UNITY_END();
}
