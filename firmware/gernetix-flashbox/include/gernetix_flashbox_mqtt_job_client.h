#pragma once
#include <Arduino.h>
struct FlashboxMqttJobClientStatus { String state; String topic; String lastJobId; String lastError; bool certificateConfigured; bool connected; };
void flashboxMqttJobClientBegin();
void flashboxMqttJobClientLoop();
FlashboxMqttJobClientStatus flashboxMqttJobClientStatus();
String flashboxMqttJobClientStatusJson();
