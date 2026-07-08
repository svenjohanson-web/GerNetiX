#include "basissoftware/functions/startDeviceWebServer.h"

#include <cstdio>
#include <cstring>

#include "esp_http_server.h"
#include "esp_timer.h"

#include "basissoftware/config.h"
#include "basissoftware/feedback.h"
#include "basissoftware/provisioning_config.h"

namespace {
constexpr const char *TAG = "deviceWeb";
httpd_handle_t server = nullptr;

esp_err_t sendPortalPage(httpd_req_t *request) {
  constexpr const char *body =
      "<!doctype html>"
      "<html lang=\"de\">"
      "<head>"
      "<meta charset=\"utf-8\">"
      "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
      "<title>GerNetiX Device</title>"
      "<style>"
      "body{font-family:system-ui,sans-serif;margin:2rem;line-height:1.4}"
      "main{max-width:42rem}"
      "a{display:block;margin:.75rem 0;color:#0645ad}"
      "code{background:#eee;padding:.1rem .3rem}"
      "</style>"
      "</head>"
      "<body>"
      "<main>"
      "<h1>GerNetiX Device</h1>"
      "<p>Setup-AP <code>GerNetiX-Setup</code> ist aktiv.</p>"
      "<p>Dieses Captive Portal verbindet dich mit dem lokalen Board-Setup.</p>"
      "<a href=\"/status\">Status</a>"
      "<a href=\"/logs\">Logs</a>"
      "<p>Recovery/Entwicklung: <code>POST /provisioning</code></p>"
      "<p>Echtheitsnachweis: <code>POST /auth/challenge</code></p>"
      "</main>"
      "</body>"
      "</html>";

  httpd_resp_set_hdr(request, "Cache-Control", "no-store");
  httpd_resp_set_type(request, "text/html; charset=utf-8");
  return httpd_resp_send(request, body, HTTPD_RESP_USE_STRLEN);
}

esp_err_t rootHandler(httpd_req_t *request) {
  return sendPortalPage(request);
}

esp_err_t captivePortalHandler(httpd_req_t *request) {
  return sendPortalPage(request);
}

esp_err_t statusHandler(httpd_req_t *request) {
  char provisioningJson[1024] = {};
  writeProvisioningStatusJson(provisioningJson, sizeof(provisioningJson));

  char body[1536] = {};
  const long long uptimeMs =
      static_cast<long long>(esp_timer_get_time() / 1000);

  std::snprintf(
      body,
      sizeof(body),
      "{"
      "\"device\":\"gernetix-esp32\","
      "\"runtime\":\"%s\","
      "\"runtimeVersion\":\"%s\","
      "\"wifiMode\":\"setup_ap\","
      "\"setupApSsid\":\"%s\","
      "\"setupApChannel\":%u,"
      "\"uptimeMs\":%lld,"
      "%s"
      "}\n",
      GERNETIX_RUNTIME_NAME,
      GERNETIX_RUNTIME_VERSION,
      WIFI_SETUP_AP_SSID,
      WIFI_SETUP_AP_CHANNEL,
      uptimeMs,
      provisioningJson);

  httpd_resp_set_type(request, "application/json");
  return httpd_resp_send(request, body, HTTPD_RESP_USE_STRLEN);
}

esp_err_t readRequestBody(httpd_req_t *request, char *body, size_t bodySize, size_t maxLength) {
  if (body == nullptr || bodySize == 0 || request->content_len <= 0 || request->content_len > maxLength || request->content_len >= bodySize) {
    httpd_resp_set_status(request, "413 Payload Too Large");
    return httpd_resp_sendstr(request, "{\"error\":\"payload_too_large\"}\n");
  }

  int received = 0;
  while (received < request->content_len) {
    const int chunk = httpd_req_recv(
        request,
        body + received,
        request->content_len - received);
    if (chunk <= 0) {
      httpd_resp_set_status(request, "400 Bad Request");
      return httpd_resp_sendstr(request, "{\"error\":\"request_read_failed\"}\n");
    }
    received += chunk;
  }
  body[received] = '\0';
  return ESP_OK;
}

esp_err_t provisioningHandler(httpd_req_t *request) {
  char body[4097] = {};
  const esp_err_t readStatus = readRequestBody(request, body, sizeof(body), 4096);
  if (readStatus != ESP_OK) {
    return readStatus;
  }

  const esp_err_t status = saveProvisioningPayload(body, std::strlen(body));
  if (status != ESP_OK) {
    httpd_resp_set_status(request, "422 Unprocessable Entity");
    return httpd_resp_sendstr(request, "{\"error\":\"invalid_provisioning_payload\"}\n");
  }

  httpd_resp_set_type(request, "application/json");
  return httpd_resp_sendstr(request, "{\"status\":\"provisioned\"}\n");
}

esp_err_t challengeHandler(httpd_req_t *request) {
  char body[1025] = {};
  const esp_err_t readStatus = readRequestBody(request, body, sizeof(body), 1024);
  if (readStatus != ESP_OK) {
    return readStatus;
  }

  char proof[768] = {};
  const esp_err_t proofStatus = writeChallengeProofJson(body, std::strlen(body), proof, sizeof(proof));
  if (proofStatus == ESP_ERR_INVALID_STATE) {
    httpd_resp_set_status(request, "409 Conflict");
    return httpd_resp_sendstr(request, "{\"error\":\"device_secret_missing\"}\n");
  }
  if (proofStatus != ESP_OK) {
    httpd_resp_set_status(request, "422 Unprocessable Entity");
    return httpd_resp_sendstr(request, "{\"error\":\"invalid_challenge_payload\"}\n");
  }

  char response[800] = {};
  std::snprintf(response, sizeof(response), "{%s}\n", proof);
  httpd_resp_set_type(request, "application/json");
  return httpd_resp_send(request, response, HTTPD_RESP_USE_STRLEN);
}

esp_err_t logsHandler(httpd_req_t *request) {
  char body[4096] = {};
  copyFeedbackLog(body, sizeof(body));

  httpd_resp_set_type(request, "text/plain; charset=utf-8");
  return httpd_resp_send(request, body, HTTPD_RESP_USE_STRLEN);
}

void registerUri(const char *uri, httpd_method_t method, esp_err_t (*handler)(httpd_req_t *)) {
  httpd_uri_t config = {};
  config.uri = uri;
  config.method = method;
  config.handler = handler;
  config.user_ctx = nullptr;

  ESP_ERROR_CHECK(httpd_register_uri_handler(server, &config));
}
}

void startDeviceWebServer() {
  if (server != nullptr) {
    return;
  }

  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = DEVICE_WEB_SERVER_PORT;
  config.ctrl_port = DEVICE_WEB_SERVER_CONTROL_PORT;
  config.lru_purge_enable = true;
  config.uri_match_fn = httpd_uri_match_wildcard;

  ESP_ERROR_CHECK(httpd_start(&server, &config));
  registerUri("/", HTTP_GET, rootHandler);
  registerUri("/status", HTTP_GET, statusHandler);
  registerUri("/logs", HTTP_GET, logsHandler);
  registerUri("/provisioning", HTTP_POST, provisioningHandler);
  registerUri("/auth/challenge", HTTP_POST, challengeHandler);
  registerUri("/*", HTTP_GET, captivePortalHandler);

  feedbackInfo(TAG, "Device web server started on port %u", DEVICE_WEB_SERVER_PORT);
}
