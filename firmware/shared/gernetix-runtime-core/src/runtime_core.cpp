#include "gernetix/runtime_core.h"

#include <cstdio>
#include <cstring>

namespace gernetix::runtime {

namespace {

void clampWritten(JsonWriter& writer) {
  if (writer.target == nullptr || writer.targetSize == 0) return;
  if (writer.written >= writer.targetSize) writer.written = writer.targetSize - 1;
  writer.target[writer.written] = '\0';
}

void appendChar(JsonWriter& writer, char value) {
  if (writer.target == nullptr || writer.targetSize == 0) return;
  if (writer.written + 1 < writer.targetSize) {
    writer.target[writer.written++] = value;
    writer.target[writer.written] = '\0';
    return;
  }
  clampWritten(writer);
}

void appendText(JsonWriter& writer, const char* value) {
  if (writer.target == nullptr || writer.targetSize == 0 || value == nullptr) return;
  while (*value != '\0') {
    appendChar(writer, *value);
    value++;
  }
}

void appendJsonEscaped(JsonWriter& writer, const char* value) {
  if (value == nullptr) return;
  for (const char* cursor = value; *cursor != '\0'; cursor++) {
    const char current = *cursor;
    switch (current) {
      case '"':
      case '\\':
        appendChar(writer, '\\');
        appendChar(writer, current);
        break;
      case '\n':
        appendText(writer, "\\n");
        break;
      case '\r':
        appendText(writer, "\\r");
        break;
      case '\t':
        appendText(writer, "\\t");
        break;
      default:
        appendChar(writer, current);
        break;
    }
  }
}

void appendFieldPrefix(JsonWriter& writer, const char* key) {
  if (writer.hasFields) appendChar(writer, ',');
  appendChar(writer, '"');
  appendJsonEscaped(writer, key);
  appendText(writer, "\":");
  writer.hasFields = true;
}

}  // namespace

void copyString(char* target, size_t targetSize, const char* source) {
  if (target == nullptr || targetSize == 0) return;
  std::snprintf(target, targetSize, "%s", source == nullptr ? "" : source);
}

char toLowerAscii(char value) {
  return value >= 'A' && value <= 'Z' ? static_cast<char>(value - 'A' + 'a') : value;
}

bool isHostnameChar(char value) {
  return (value >= 'a' && value <= 'z') ||
         (value >= '0' && value <= '9') ||
         value == '-';
}

void appendHostnamePart(char* target, size_t targetSize, size_t& written, const char* value) {
  if (target == nullptr || targetSize == 0 || value == nullptr) return;
  bool previousDash = written == 0 || target[written - 1] == '-';
  for (const char* cursor = value; *cursor != '\0' && written + 1 < targetSize; cursor++) {
    char next = toLowerAscii(*cursor);
    if (!isHostnameChar(next)) next = '-';
    if (next == '-' && previousDash) continue;
    target[written++] = next;
    previousDash = next == '-';
  }
  while (written > 0 && target[written - 1] == '-') written--;
  target[written] = '\0';
}

void writeGerNetixDeviceName(char* target, size_t targetSize, const char* serialNumber, const char* deviceId, const char* fallbackName) {
  if (target == nullptr || targetSize == 0) return;
  if (serialNumber != nullptr && serialNumber[0] != '\0') {
    std::snprintf(target, targetSize, "GerNetiX %s", serialNumber);
    return;
  }
  if (deviceId != nullptr && deviceId[0] != '\0') {
    std::snprintf(target, targetSize, "GerNetiX %s", deviceId);
    return;
  }
  copyString(target, targetSize, fallbackName);
}

void writeGerNetixHostname(char* target, size_t targetSize, const char* serialNumber, const char* deviceId, const char* fallbackHostname) {
  if (target == nullptr || targetSize == 0) return;
  target[0] = '\0';
  if ((serialNumber == nullptr || serialNumber[0] == '\0') && (deviceId == nullptr || deviceId[0] == '\0')) {
    copyString(target, targetSize, fallbackHostname);
    return;
  }
  size_t written = 0;
  appendHostnamePart(target, targetSize, written, "gernetix");
  if (written + 1 < targetSize) {
    target[written++] = '-';
    target[written] = '\0';
  }
  appendHostnamePart(target, targetSize, written, serialNumber != nullptr && serialNumber[0] != '\0' ? serialNumber : deviceId);
  if (written == 0) copyString(target, targetSize, fallbackHostname);
}

void jsonBegin(JsonWriter& writer) {
  if (writer.target == nullptr || writer.targetSize == 0) return;
  writer.written = 0;
  writer.hasFields = false;
  appendChar(writer, '{');
}

void jsonAppendRaw(JsonWriter& writer, const char* key, const char* rawValue) {
  appendFieldPrefix(writer, key);
  appendText(writer, rawValue == nullptr ? "null" : rawValue);
}

void jsonAppendString(JsonWriter& writer, const char* key, const char* value) {
  appendFieldPrefix(writer, key);
  appendChar(writer, '"');
  appendJsonEscaped(writer, value == nullptr ? "" : value);
  appendChar(writer, '"');
}

void jsonAppendBool(JsonWriter& writer, const char* key, bool value) {
  jsonAppendRaw(writer, key, value ? "true" : "false");
}

void jsonEnd(JsonWriter& writer) {
  appendChar(writer, '}');
  clampWritten(writer);
}

size_t writeRuntimeIdentityJsonFields(JsonWriter& writer, const RuntimeIdentity& identity) {
  jsonAppendString(writer, "role", identity.role);
  jsonAppendString(writer, "device_id", identity.deviceId);
  jsonAppendString(writer, "serial_number", identity.serialNumber);
  jsonAppendString(writer, "hardware_profile_id", identity.hardwareProfileId);
  jsonAppendString(writer, "firmware_version", identity.firmwareVersion);
  jsonAppendString(writer, "firmware_basis", identity.firmwareBasis);
  return writer.written;
}

void formatSerialFromMac(char* target, size_t targetSize, const char* prefix, uint64_t mac) {
  if (target == nullptr || targetSize == 0) return;
  std::snprintf(
    target,
    targetSize,
    "%s%04X%08X",
    prefix == nullptr ? "" : prefix,
    static_cast<unsigned>((mac >> 32) & 0xffff),
    static_cast<unsigned>(mac & 0xffffffff)
  );
}

#if defined(ARDUINO)
String jsonEscapeArduino(const String& value) {
  String escaped;
  escaped.reserve(value.length() + 8);
  for (size_t index = 0; index < value.length(); index += 1) {
    const char current = value.charAt(index);
    switch (current) {
      case '"':
      case '\\':
        escaped += '\\';
        escaped += current;
        break;
      case '\n':
        escaped += "\\n";
        break;
      case '\r':
        escaped += "\\r";
        break;
      case '\t':
        escaped += "\\t";
        break;
      default:
        escaped += current;
        break;
    }
  }
  return escaped;
}

String serialFromMacArduino(const char* prefix, uint64_t mac) {
  char value[64] = {};
  formatSerialFromMac(value, sizeof(value), prefix, mac);
  return String(value);
}
#endif

}  // namespace gernetix::runtime

