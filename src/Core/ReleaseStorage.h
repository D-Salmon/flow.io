#pragma once

#include <FS.h>

enum class ReleaseSlot : uint8_t { A = 0, B = 1 };

namespace ReleaseStorage {
inline constexpr const char* kSlotALabel = "spiffs0";
inline constexpr const char* kSlotBLabel = "spiffs1";
inline constexpr const char* kRuntimeLabel = "runtime";
bool beginReleaseFilesystem();
bool beginRuntimeFilesystem();
ReleaseSlot runningSlot();
ReleaseSlot inactiveSlot();
const char* filesystemLabel(ReleaseSlot slot);
const char* applicationLabel(ReleaseSlot slot);
bool releaseReady();
bool runtimeReady();
fs::FS& releaseFilesystem();
fs::FS& runtimeFilesystem();
bool validateReleaseFilesystem();
bool validateReleaseFilesystem(fs::FS& filesystem, const char* expectedVersion, const char* expectedHardware);
bool confirmPendingApplication();
}  // namespace ReleaseStorage
