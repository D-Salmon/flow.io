#pragma once
/**
 * @file NextionDisplayIdentity.h
 * @brief Strict parsing and normalization of Nextion display identities.
 */

#include "Core/Services/IHmi.h"

#include <stddef.h>

bool parseNextionDisplayModel(const char* model, HmiDisplayIdentity& out);
bool parseNextionConnectResponse(const char* response, HmiDisplayIdentity& out);
bool isNextionDisplayCompatible(const HmiDisplayIdentity& identity,
                                const char* expectedCompatibility);
bool parseNextionArtifactFilename(const char* filename,
                                  char* compatibilityOut,
                                  size_t compatibilityOutLen,
                                  char* versionOut,
                                  size_t versionOutLen);
int compareNextionVersions(const char* left, const char* right);
