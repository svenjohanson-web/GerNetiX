#pragma once

#include <cstddef>

#include "esp_err.h"

// Starts one MQTT client for device-specific OTA notifications. Calling the
// function again is harmless. A missing broker configuration disables MQTT.
esp_err_t startMqttOtaSubscriber();

// Appends one JSON member: "mqtt":{"state":"...","topic":"..."}
size_t writeMqttOtaStatusJson(char *target, size_t targetSize);
void publishMqttOtaStatus(const char *state, const char *deployId, const char *error);
