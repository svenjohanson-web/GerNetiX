#pragma once

#include <cstddef>
#include <cstdint>

// Captures the previous boot's bounded RTC snapshot before other subsystems
// start. No credentials, payloads or arbitrary project strings are retained.
void initializeCrashDiagnostics();

// Starts a low-priority monitor that updates the RTC snapshot and marks the
// boot healthy after a stable runtime milestone. It never writes flash/NVS.
void startCrashDiagnosticsMonitor();

// Produces a bounded JSON object for /status and the serial diagnostics path.
bool writeCrashDiagnosticsJson(char *target, size_t targetSize);

// Reports global heap headroom and the minimum remaining stack of every
// currently running FreeRTOS task. Task names and ownership are bounded,
// credentials and application payloads are never included.
bool writeRuntimeResourceDiagnosticsJson(char *target, size_t targetSize);

// Exact SHA-256 of the ELF embedded by ESP-IDF, rendered as lowercase hex.
void writeFirmwareBuildId(char *target, size_t targetSize);

// Fixed-field hook for controlled fatal paths. The API intentionally accepts
// no free-form payload and remains safe to call before a planned restart.
void recordCrashFaultContext(const char *faultCode, const char *taskName, uintptr_t programCounter);
