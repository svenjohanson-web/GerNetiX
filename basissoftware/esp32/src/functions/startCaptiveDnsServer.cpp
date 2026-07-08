#include "basissoftware/functions/startCaptiveDnsServer.h"

#include <cstddef>
#include <cstdint>
#include <cstring>
#include <unistd.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "lwip/inet.h"
#include "lwip/sockets.h"

#include "basissoftware/config.h"
#include "basissoftware/feedback.h"

namespace {
constexpr const char *TAG = "captiveDns";
constexpr uint16_t DNS_FLAGS_QUERY_RESPONSE = 0x8180;
constexpr uint16_t DNS_TYPE_A = 1;
constexpr uint16_t DNS_CLASS_IN = 1;
constexpr uint32_t DNS_ANSWER_TTL_SECONDS = 30;
constexpr size_t DNS_HEADER_SIZE = 12;
TaskHandle_t dnsTaskHandle = nullptr;

uint16_t readUint16(const uint8_t *data) {
  return static_cast<uint16_t>((data[0] << 8) | data[1]);
}

void writeUint16(uint8_t *data, uint16_t value) {
  data[0] = static_cast<uint8_t>((value >> 8) & 0xff);
  data[1] = static_cast<uint8_t>(value & 0xff);
}

void writeUint32(uint8_t *data, uint32_t value) {
  data[0] = static_cast<uint8_t>((value >> 24) & 0xff);
  data[1] = static_cast<uint8_t>((value >> 16) & 0xff);
  data[2] = static_cast<uint8_t>((value >> 8) & 0xff);
  data[3] = static_cast<uint8_t>(value & 0xff);
}

size_t questionEndOffset(const uint8_t *packet, size_t length) {
  size_t offset = DNS_HEADER_SIZE;
  while (offset < length && packet[offset] != 0) {
    offset += static_cast<size_t>(packet[offset]) + 1;
  }

  if (offset + 5 > length) {
    return 0;
  }

  return offset + 5;
}

size_t createCaptiveAnswer(
    const uint8_t *request,
    size_t requestLength,
    uint8_t *response,
    size_t responseSize) {
  if (requestLength < DNS_HEADER_SIZE || responseSize < requestLength + 16) {
    return 0;
  }

  const uint16_t questionCount = readUint16(request + 4);
  if (questionCount == 0) {
    return 0;
  }

  const size_t questionEnd = questionEndOffset(request, requestLength);
  if (questionEnd == 0 || questionEnd > responseSize - 16) {
    return 0;
  }

  std::memcpy(response, request, questionEnd);
  writeUint16(response + 2, DNS_FLAGS_QUERY_RESPONSE);
  writeUint16(response + 4, 1);
  writeUint16(response + 6, 1);
  writeUint16(response + 8, 0);
  writeUint16(response + 10, 0);

  size_t offset = questionEnd;
  response[offset++] = 0xc0;
  response[offset++] = 0x0c;
  writeUint16(response + offset, DNS_TYPE_A);
  offset += 2;
  writeUint16(response + offset, DNS_CLASS_IN);
  offset += 2;
  writeUint32(response + offset, DNS_ANSWER_TTL_SECONDS);
  offset += 4;
  writeUint16(response + offset, 4);
  offset += 2;

  in_addr address = {};
  address.s_addr = inet_addr(CAPTIVE_PORTAL_AP_IP);
  std::memcpy(response + offset, &address.s_addr, 4);
  offset += 4;

  return offset;
}

void captiveDnsTask(void *) {
  const int socketFd = socket(AF_INET, SOCK_DGRAM, IPPROTO_IP);
  if (socketFd < 0) {
    feedbackWarning(TAG, "DNS socket could not be created");
    dnsTaskHandle = nullptr;
    vTaskDelete(nullptr);
    return;
  }

  sockaddr_in serverAddress = {};
  serverAddress.sin_family = AF_INET;
  serverAddress.sin_port = htons(CAPTIVE_PORTAL_DNS_PORT);
  serverAddress.sin_addr.s_addr = htonl(INADDR_ANY);

  if (bind(socketFd, reinterpret_cast<sockaddr *>(&serverAddress), sizeof(serverAddress)) < 0) {
    feedbackWarning(TAG, "DNS socket bind failed on port %u", CAPTIVE_PORTAL_DNS_PORT);
    close(socketFd);
    dnsTaskHandle = nullptr;
    vTaskDelete(nullptr);
    return;
  }

  feedbackInfo(TAG, "Captive DNS started: * -> %s", CAPTIVE_PORTAL_AP_IP);

  while (true) {
    uint8_t request[256] = {};
    uint8_t response[288] = {};
    sockaddr_in clientAddress = {};
    socklen_t clientAddressLength = sizeof(clientAddress);
    const int received = recvfrom(
        socketFd,
        request,
        sizeof(request),
        0,
        reinterpret_cast<sockaddr *>(&clientAddress),
        &clientAddressLength);

    if (received <= 0) {
      continue;
    }

    const size_t responseLength = createCaptiveAnswer(
        request,
        static_cast<size_t>(received),
        response,
        sizeof(response));
    if (responseLength == 0) {
      continue;
    }

    sendto(
        socketFd,
        response,
        responseLength,
        0,
        reinterpret_cast<sockaddr *>(&clientAddress),
        clientAddressLength);
  }
}
}

void startCaptiveDnsServer() {
  if (dnsTaskHandle != nullptr) {
    return;
  }

  xTaskCreate(
      captiveDnsTask,
      "gernetix-captive-dns",
      4096,
      nullptr,
      5,
      &dnsTaskHandle);
}
