#include "gernetix_flashbox_json_response.h"

#include <cstdio>
#include <cstring>

#include "gernetix_flashbox_config.h"

namespace {

char responseBuffer[GERNETIX_FLASHBOX_JSON_RESPONSE_BUFFER_BYTES] = {};
char numericBuffer[32] = {};

}  // namespace

gernetix::runtime::JsonWriter flashboxJsonResponseWriter() {
  std::memset(responseBuffer, 0, sizeof(responseBuffer));
  return gernetix::runtime::JsonWriter{ responseBuffer, sizeof(responseBuffer), 0, false };
}

String flashboxJsonResponseString() {
  return String(responseBuffer);
}

void flashboxJsonAppendInt(gernetix::runtime::JsonWriter& writer, const char* key, int value) {
  snprintf(numericBuffer, sizeof(numericBuffer), "%d", value);
  gernetix::runtime::jsonAppendRaw(writer, key, numericBuffer);
}

void flashboxJsonAppendUnsigned(gernetix::runtime::JsonWriter& writer, const char* key, unsigned value) {
  snprintf(numericBuffer, sizeof(numericBuffer), "%u", value);
  gernetix::runtime::jsonAppendRaw(writer, key, numericBuffer);
}
