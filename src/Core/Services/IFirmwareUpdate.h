#pragma once
/**
 * @file IFirmwareUpdate.h
 * @brief Firmware update service interface.
 */

#include <stddef.h>
#include <stdint.h>

class Print;

enum class FirmwareUpdateTarget : uint8_t {
    Nextion = 2,
    Waveshare = 3,
    Spiffs = 4
};

struct FirmwareUpdateService {
    bool (*start)(void* ctx,
                  FirmwareUpdateTarget target,
                  const char* url,
                  uint32_t* operationIdOut,
                  char* errOut,
                  size_t errOutLen);
    bool (*statusJson)(void* ctx, char* out, size_t outLen);
    bool (*isBusy)(void* ctx);
    bool (*configJson)(void* ctx, char* out, size_t outLen);
    bool (*checkManifestJsonStream)(void* ctx, Print& out, char* errOut, size_t errOutLen);
    bool (*manifestUrl)(void* ctx, char* out, size_t outLen, char* errOut, size_t errOutLen);
    bool (*setConfig)(void* ctx,
                      const char* updateHost,
                      const char* updatePath,
                      char* errOut,
                      size_t errOutLen);
    bool (*beginLocalRelease)(void* ctx,
                              const char* manifestJson,
                              size_t manifestLen,
                              uint32_t* transactionIdOut,
                              char* errOut,
                              size_t errOutLen);
    bool (*beginLocalImage)(void* ctx,
                            uint32_t transactionId,
                            FirmwareUpdateTarget target,
                            size_t totalSize,
                            char* errOut,
                            size_t errOutLen);
    bool (*writeLocalImage)(void* ctx,
                            uint32_t transactionId,
                            FirmwareUpdateTarget target,
                            const uint8_t* data,
                            size_t len,
                            size_t offset,
                            char* errOut,
                            size_t errOutLen);
    bool (*endLocalImage)(void* ctx,
                          uint32_t transactionId,
                          FirmwareUpdateTarget target,
                          char* errOut,
                          size_t errOutLen);
    bool (*commitLocalRelease)(void* ctx, uint32_t transactionId, char* errOut, size_t errOutLen);
    bool (*abortLocalRelease)(void* ctx, uint32_t transactionId, char* errOut, size_t errOutLen);
    void* ctx;
};
