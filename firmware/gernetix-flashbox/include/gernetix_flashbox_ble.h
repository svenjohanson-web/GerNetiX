#pragma once

// Native ESP-IDF NimBLE facade.  The FlashBox uses it instead of Arduino's
// legacy BLE library because this firmware combines Arduino with ESP-IDF.
#ifdef __cplusplus
extern "C" {
#endif

void flashboxBleBegin(const char* deviceName);
void flashboxBleUpdateStatus(const char* statusJson);

#ifdef __cplusplus
}
#endif
