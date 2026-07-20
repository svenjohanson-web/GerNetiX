#pragma once

#include <Arduino.h>

#include "gernetix/runtime_core.h"

gernetix::runtime::JsonWriter flashboxJsonResponseWriter();
String flashboxJsonResponseString();
void flashboxJsonAppendInt(gernetix::runtime::JsonWriter& writer, const char* key, int value);
void flashboxJsonAppendUnsigned(gernetix::runtime::JsonWriter& writer, const char* key, unsigned value);
