#pragma once

#include <cstddef>

#include "esp_err.h"

// Authenticates and queues one OTA deploy command. The command is copied before
// this function returns, so callers may release the request buffer immediately.
esp_err_t scheduleOtaUpdate(const char *payload, size_t payloadLength);

// Appends a JSON object member such as: "ota":{"state":"idle",...}
size_t writeOtaStatusJson(char *target, size_t targetSize);

// Confirms a newly installed image only after the normal runtime initialization
// and diagnostics have completed. Until then the bootloader may roll it back.
void confirmRunningOtaImage();
