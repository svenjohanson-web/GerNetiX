#pragma once

#include <cstddef>
#include <cstdint>

#if defined(ARDUINO)
#include <Arduino.h>
#endif

namespace gernetix::runtime {

struct RuntimeIdentity {
  const char* role;
  const char* deviceId;
  const char* serialNumber;
  const char* hardwareProfileId;
  const char* firmwareVersion;
  const char* firmwareBasis;
};

struct JsonWriter {
  char* target;
  size_t targetSize;
  size_t written;
  bool hasFields;
};

void copyString(char* target, size_t targetSize, const char* source);
char toLowerAscii(char value);
bool isHostnameChar(char value);
void appendHostnamePart(char* target, size_t targetSize, size_t& written, const char* value);
void writeGerNetixDeviceName(char* target, size_t targetSize, const char* serialNumber, const char* deviceId, const char* fallbackName);
void writeGerNetixHostname(char* target, size_t targetSize, const char* serialNumber, const char* deviceId, const char* fallbackHostname);

void jsonBegin(JsonWriter& writer);
void jsonAppendRaw(JsonWriter& writer, const char* key, const char* rawValue);
void jsonAppendString(JsonWriter& writer, const char* key, const char* value);
void jsonAppendBool(JsonWriter& writer, const char* key, bool value);
void jsonEnd(JsonWriter& writer);
size_t writeRuntimeIdentityJsonFields(JsonWriter& writer, const RuntimeIdentity& identity);

void formatSerialFromMac(char* target, size_t targetSize, const char* prefix, uint64_t mac);

#if defined(ARDUINO)
String jsonEscapeArduino(const String& value);
String serialFromMacArduino(const char* prefix, uint64_t mac);
#endif

}  // namespace gernetix::runtime

