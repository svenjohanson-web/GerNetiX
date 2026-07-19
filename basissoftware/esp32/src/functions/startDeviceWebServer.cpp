#include "basissoftware/functions/startDeviceWebServer.h"

#include <cstdlib>
#include <cstdio>
#include <cstring>

#include "esp_http_server.h"
#include "esp_timer.h"

#include "basissoftware/config.h"
#include "basissoftware/feedback.h"
#include "basissoftware/mqtt_ota.h"
#include "basissoftware/ota_update.h"
#include "basissoftware/provisioning_config.h"
#include "basissoftware/wifi_manager.h"

namespace {
constexpr const char *TAG = "deviceWeb";
constexpr size_t LOG_RESPONSE_SIZE = 2304;
constexpr size_t WIFI_SCAN_RESPONSE_SIZE = 2048;
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
      ":root{color-scheme:dark;--bg:#0b1018;--panel:#111827;--line:#334155;--text:#e5e7eb;--muted:#94a3b8;--accent:#22d3ee;--accent-dark:#0e7490}"
      "*{box-sizing:border-box}"
      "body{min-height:100vh;margin:0;background:radial-gradient(circle at top,#164e63 0,#0b1018 42rem);color:var(--text);font:16px/1.45 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}"
      "main{width:min(100% - 2rem,42rem);margin:0 auto;padding:2.5rem 0}"
      ".brand{margin-bottom:1.25rem}.brand-row{display:flex;align-items:center;gap:.8rem}.brand-logo{width:52px;height:52px;flex:0 0 auto}.brand-word{margin:0 0 .28rem;color:#f8fafc;font-size:1.05rem;font-weight:900;letter-spacing:.12em}.brand-word span{color:var(--accent)}.eyebrow{margin:0 0 .35rem;color:var(--accent);font-size:.78rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase}"
      "h1{margin:0;font-size:clamp(1.65rem,6vw,2.2rem);line-height:1.1}.basis-meta{margin:.65rem 0 0;color:var(--muted);font-size:.9rem}"
      ".panel{border:1px solid var(--line);border-radius:14px;padding:1.25rem;background:rgba(15,23,42,.92);box-shadow:0 24px 60px rgba(0,0,0,.22)}"
      ".intro{margin:0 0 1.15rem;color:#cbd5e1}.intro code{color:#cffafe}"
      "label{display:grid;gap:.45rem;margin:1rem 0 0;color:#cbd5e1;font-size:.88rem;font-weight:750}"
      "select,input,button{width:100%;border-radius:8px;font:inherit}select,input{min-height:44px;border:1px solid var(--line);padding:.65rem .75rem;background:#0b1018;color:var(--text)}"
      "select:focus,input:focus{outline:2px solid var(--accent);outline-offset:2px;border-color:var(--accent)}"
      "button{min-height:44px;margin-top:1.25rem;border:1px solid var(--accent-dark);padding:.65rem .9rem;background:var(--accent-dark);color:#ecfeff;font-weight:800;cursor:pointer}button:hover{background:#0891b2;border-color:var(--accent)}"
      "#wifi-status{min-height:48px;margin-top:1rem;border:1px solid #155e75;border-radius:8px;padding:.75rem;background:#0c2130;color:#cffafe;white-space:pre-wrap;font-size:.9rem}"
      ".links{display:flex;gap:1rem;margin-top:1rem}.links a{color:#67e8f9;font-size:.88rem;text-decoration:none}.links a:hover{text-decoration:underline}"
      "</style>"
      "</head>"
      "<body>"
      "<main>"
      "<header class=\"brand\">"
      "<div class=\"brand-row\">"
      "<svg class=\"brand-logo\" viewBox=\"0 0 64 64\" role=\"img\" aria-label=\"GerNetiX\"><path d=\"M8 12c12-10 36-10 48 0\" fill=\"none\" stroke=\"#22d3ee\" stroke-width=\"3\" stroke-linecap=\"round\"/><path d=\"M8 52c12 10 36 10 48 0\" fill=\"none\" stroke=\"#22d3ee\" stroke-width=\"3\" stroke-linecap=\"round\"/><path d=\"M19 20l16 12-16 12h10l16-12-16-12z\" fill=\"#f8fafc\"/><path d=\"M45 20l-11 12 11 12h-9L25 32l11-12z\" fill=\"#22d3ee\"/></svg>"
      "<div><p class=\"brand-word\">GERNETI<span>X</span></p>"
      "<p class=\"eyebrow\">GerNetiX Basissoftware</p>"
      "<h1>WLAN einrichten</h1>"
      "<p id=\"basis-meta\" class=\"basis-meta\"><strong>Basissoftware:</strong> wird geladen...</p></div>"
      "</div>"
      "</header>"
      "<section class=\"panel\">"
      "<p class=\"intro\">Du bist mit <code>GerNetiX-Setup</code> verbunden. Waehle jetzt dein WLAN und speichere die Zugangsdaten direkt auf dem Board.</p>"
      "<form method=\"post\" action=\"/wifi\">"
      "<label for=\"ssid\">WLAN</label>"
      "<select id=\"ssid\" name=\"ssid\"><option value=\"\">Suche Netzwerke...</option></select>"
      "<label for=\"password\">Passwort</label>"
      "<input id=\"password\" name=\"password\" type=\"password\" autocomplete=\"current-password\">"
      "<button type=\"submit\">Verbinden</button>"
      "</form>"
      "<div id=\"wifi-status\" role=\"status\">Bereit.</div>"
      "</section>"
      "<nav class=\"links\"><a href=\"/status\">Status</a><a href=\"/logs\">Diagnose-Logs</a></nav>"
      "</main>"
      "<script>"
      "const statusBox=document.getElementById('wifi-status');"
      "const basisMeta=document.getElementById('basis-meta');"
      "function showStatus(s){basisMeta.innerHTML='<strong>Basissoftware:</strong> '+(s.basissoftwareVersion||s.runtimeVersion||'unbekannt')+' · Variante: '+(s.basissoftwareVariant||'unbekannt');return s;}"
      "fetch('/status').then(r=>r.json()).then(showStatus).catch(()=>{basisMeta.textContent='Basissoftware-Metadaten nicht erreichbar.';});"
      "fetch('/wifi/scan').then(r=>r.json()).then(d=>{"
      "const s=document.getElementById('ssid');s.innerHTML='';"
      "(d.networks||[]).forEach(n=>{const o=document.createElement('option');"
      "o.value=n.ssid;o.textContent=n.ssid+' ('+n.rssi+' dBm)'+(n.secure?'':' offen');s.appendChild(o);});"
      "if(!s.children.length){const o=document.createElement('option');o.value='';o.textContent='Keine Netzwerke gefunden';s.appendChild(o);}"
      "}).catch(()=>{document.getElementById('ssid').innerHTML='<option value=\"\">Scan fehlgeschlagen</option>';});"
      "function poll(){fetch('/status').then(r=>r.json()).then(showStatus).then(s=>{"
      "statusBox.textContent='Modus: '+s.wifiMode+'\\nStation: '+s.wifiStationState+'\\nLetzter Fehler: status='+s.wifiLastConnectStatus+', reason='+s.wifiLastDisconnectReason;"
      "if(s.wifiStationState==='connecting')setTimeout(poll,1000);"
      "if(s.wifiStationState==='connected')statusBox.textContent+='\\nVerbunden. Der Setup-AP wird gleich abgeschaltet.';"
      "if(s.wifiStationState==='failed')statusBox.textContent+='\\nVerbindung fehlgeschlagen. Bitte SSID, Passwort und WLAN-Reichweite pruefen.';"
      "}).catch(()=>{});}"
      "document.querySelector('form').addEventListener('submit',e=>{"
      "e.preventDefault();statusBox.textContent='Speichere WLAN-Daten...';"
      "fetch('/wifi',{method:'POST',body:new URLSearchParams(new FormData(e.target))})"
      ".then(r=>r.text()).then(t=>{statusBox.textContent=t+'\\nWarte auf Verbindung...';setTimeout(poll,1000);})"
      ".catch(()=>{statusBox.textContent='Request fehlgeschlagen. Setup-AP kann gerade umschalten; bitte /logs pruefen.';});"
      "});"
      "</script>"
      "</body>"
      "</html>";

  httpd_resp_set_hdr(request, "Cache-Control", "no-store");
  httpd_resp_set_type(request, "text/html; charset=utf-8");
  return httpd_resp_send(request, body, HTTPD_RESP_USE_STRLEN);
}

esp_err_t rootHandler(httpd_req_t *request) {
  return sendPortalPage(request);
}

esp_err_t healthHandler(httpd_req_t *request) {
  httpd_resp_set_type(request, "text/plain; charset=utf-8");
  return httpd_resp_sendstr(request, "ok\n");
}

esp_err_t captivePortalHandler(httpd_req_t *request) {
  return sendPortalPage(request);
}

esp_err_t statusHandler(httpd_req_t *request) {
  char *provisioningJson = static_cast<char *>(std::calloc(4096, 1));
  char *body = static_cast<char *>(std::calloc(6144, 1));
  if (provisioningJson == nullptr || body == nullptr) {
    std::free(provisioningJson);
    std::free(body);
    httpd_resp_set_status(request, "500 Internal Server Error");
    return httpd_resp_sendstr(request, "{\"error\":\"status_memory_allocation_failed\"}\n");
  }
  writeProvisioningStatusJson(provisioningJson, 4096);
  char hostname[32] = {};
  writeProvisioningHostname(hostname, sizeof(hostname));
  char otaJson[256] = {};
  writeOtaStatusJson(otaJson, sizeof(otaJson));
  char mqttJson[256] = {};
  writeMqttOtaStatusJson(mqttJson, sizeof(mqttJson));

  const long long uptimeMs =
      static_cast<long long>(esp_timer_get_time() / 1000);

  std::snprintf(
      body,
      6144,
      "{"
      "\"device\":\"%s\","
      "\"runtime\":\"%s\","
      "\"runtimeVersion\":\"%s\","
      "\"basissoftwareVersion\":\"%s\","
      "\"basissoftwareVariant\":\"%s\","
      "\"wifiMode\":\"%s\","
      "\"setupApSsid\":\"%s\","
      "\"setupApChannel\":%u,"
      "\"wifiStationState\":\"%s\","
      "\"wifiLastConnectStatus\":%d,"
      "\"wifiLastDisconnectReason\":%d,"
      "\"uptimeMs\":%lld,"
      "%s,"
      "%s,"
      "%s"
      "}\n",
      hostname,
      GERNETIX_RUNTIME_NAME,
      GERNETIX_RUNTIME_VERSION,
      GERNETIX_BASISSOFTWARE_VERSION,
      GERNETIX_BASISSOFTWARE_VARIANT,
      wifiRuntimeModeName(),
      WIFI_SETUP_AP_SSID,
      WIFI_SETUP_AP_CHANNEL,
      wifiStationStateName(),
      wifiLastConnectStatus(),
      wifiLastDisconnectReason(),
      uptimeMs,
      provisioningJson,
      otaJson,
      mqttJson);

  httpd_resp_set_type(request, "application/json");
  const esp_err_t status = httpd_resp_send(request, body, HTTPD_RESP_USE_STRLEN);
  std::free(provisioningJson);
  std::free(body);
  return status;
}

char hexToNibble(char value) {
  if (value >= '0' && value <= '9') return value - '0';
  if (value >= 'a' && value <= 'f') return value - 'a' + 10;
  if (value >= 'A' && value <= 'F') return value - 'A' + 10;
  return 0;
}

void urlDecode(char *value) {
  char *read = value;
  char *write = value;
  while (*read != '\0') {
    if (*read == '+') {
      *write++ = ' ';
      read++;
      continue;
    }
    if (*read == '%' && read[1] != '\0' && read[2] != '\0') {
      *write++ = static_cast<char>((hexToNibble(read[1]) << 4) | hexToNibble(read[2]));
      read += 3;
      continue;
    }
    *write++ = *read++;
  }
  *write = '\0';
}

void findFormValue(const char *body, const char *key, char *target, size_t targetSize) {
  if (target == nullptr || targetSize == 0) {
    return;
  }
  target[0] = '\0';

  const size_t keyLength = std::strlen(key);
  const char *cursor = body;
  while (cursor != nullptr && *cursor != '\0') {
    if (std::strncmp(cursor, key, keyLength) == 0 && cursor[keyLength] == '=') {
      cursor += keyLength + 1;
      size_t copied = 0;
      while (*cursor != '\0' && *cursor != '&' && copied + 1 < targetSize) {
        target[copied++] = *cursor++;
      }
      target[copied] = '\0';
      urlDecode(target);
      return;
    }
    cursor = std::strchr(cursor, '&');
    if (cursor != nullptr) {
      cursor++;
    }
  }
}

esp_err_t readRequestBody(httpd_req_t *request, char *body, size_t bodySize, size_t maxLength) {
  if (body == nullptr || bodySize == 0 || request->content_len <= 0 || request->content_len > maxLength || request->content_len >= bodySize) {
    feedbackWarning(TAG, "Rejected request body: length=%d max=%u", request->content_len, static_cast<unsigned>(maxLength));
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
      feedbackWarning(TAG, "Request body read failed after %d bytes", received);
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

  const esp_err_t mqttStatus = startMqttOtaSubscriber();
  if (mqttStatus != ESP_OK && mqttStatus != ESP_ERR_NOT_FOUND) {
    feedbackWarning(TAG, "MQTT OTA client could not start after provisioning: %d", mqttStatus);
  }

  char provisioningJson[4096] = {};
  writeProvisioningStatusJson(provisioningJson, sizeof(provisioningJson));
  char response[4200] = {};
  std::snprintf(response, sizeof(response), "{%s}\n", provisioningJson);
  httpd_resp_set_type(request, "application/json");
  return httpd_resp_send(request, response, HTTPD_RESP_USE_STRLEN);
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
    return httpd_resp_sendstr(request, "{\"error\":\"device_private_key_missing\"}\n");
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

esp_err_t otaHandler(httpd_req_t *request) {
  char body[2049] = {};
  const esp_err_t readStatus = readRequestBody(request, body, sizeof(body), 2048);
  if (readStatus != ESP_OK) return readStatus;

  const esp_err_t status = scheduleOtaUpdate(body, std::strlen(body));
  httpd_resp_set_type(request, "application/json");
  if (status == ESP_ERR_INVALID_RESPONSE) {
    httpd_resp_set_status(request, "401 Unauthorized");
    return httpd_resp_sendstr(request, "{\"error\":\"invalid_ota_authorization\"}\n");
  }
  if (status == ESP_ERR_INVALID_STATE) {
    httpd_resp_set_status(request, "409 Conflict");
    return httpd_resp_sendstr(request, "{\"error\":\"ota_busy_or_replayed\"}\n");
  }
  if (status != ESP_OK) {
    httpd_resp_set_status(request, "422 Unprocessable Entity");
    return httpd_resp_sendstr(request, "{\"error\":\"invalid_ota_command\"}\n");
  }
  httpd_resp_set_status(request, "202 Accepted");
  return httpd_resp_sendstr(request, "{\"status\":\"ota_queued\"}\n");
}

esp_err_t wifiScanHandler(httpd_req_t *request) {
  char *body = static_cast<char *>(std::malloc(WIFI_SCAN_RESPONSE_SIZE));
  if (body == nullptr) {
    httpd_resp_set_status(request, "500 Internal Server Error");
    return httpd_resp_sendstr(request, "{\"error\":\"scan_response_allocation_failed\"}\n");
  }

  const esp_err_t status = scanWifiNetworksJson(body, WIFI_SCAN_RESPONSE_SIZE);
  httpd_resp_set_type(request, "application/json");
  if (status != ESP_OK) {
    feedbackWarning(TAG, "WiFi scan request failed: status=%d", status);
    httpd_resp_set_status(request, "503 Service Unavailable");
  }
  const esp_err_t responseStatus = httpd_resp_send(request, body, HTTPD_RESP_USE_STRLEN);
  std::free(body);
  return responseStatus;
}

esp_err_t wifiConnectHandler(httpd_req_t *request) {
  char body[256] = {};
  const esp_err_t readStatus = readRequestBody(request, body, sizeof(body), 255);
  if (readStatus != ESP_OK) {
    return readStatus;
  }

  char ssid[33] = {};
  char password[65] = {};
  findFormValue(body, "ssid", ssid, sizeof(ssid));
  findFormValue(body, "password", password, sizeof(password));

  if (saveWifiStationCredentials(ssid, password) != ESP_OK) {
    feedbackWarning(TAG, "Rejected WiFi credentials: ssid length=%u", static_cast<unsigned>(std::strlen(ssid)));
    httpd_resp_set_status(request, "422 Unprocessable Entity");
    return httpd_resp_sendstr(request, "WLAN-Daten konnten nicht gespeichert werden.\n");
  }

  httpd_resp_set_type(request, "text/plain; charset=utf-8");
  const esp_err_t responseStatus = httpd_resp_sendstr(
      request,
      "WLAN-Daten gespeichert. Verbindung wird im Hintergrund gestartet. Wenn sie klappt, verschwindet der Setup-AP.\n");
  const esp_err_t connectStatus = requestWifiStationConnectFromSavedCredentials();
  if (connectStatus != ESP_OK) {
    feedbackWarning(TAG, "WiFi connect task could not be scheduled: %d", connectStatus);
  }
  return responseStatus;
}

esp_err_t logsHandler(httpd_req_t *request) {
  char *body = static_cast<char *>(std::malloc(LOG_RESPONSE_SIZE));
  if (body == nullptr) {
    feedbackWarning(TAG, "Log response allocation failed: bytes=%u", static_cast<unsigned>(LOG_RESPONSE_SIZE));
    httpd_resp_set_status(request, "500 Internal Server Error");
    return httpd_resp_sendstr(request, "log buffer allocation failed\n");
  }
  copyFeedbackLog(body, LOG_RESPONSE_SIZE);

  httpd_resp_set_type(request, "text/plain; charset=utf-8");
  const esp_err_t status = httpd_resp_send(request, body, HTTPD_RESP_USE_STRLEN);
  std::free(body);
  return status;
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
#if defined(GERNETIX_DIAGNOSTIC_MINIMAL_HTTP_SERVER)
  // Deliberately use the ESP-IDF defaults without GerNetiX routes, custom
  // stack sizing, core affinity or wildcard matching. This is a controlled
  // baseline for the S3 HTTP task itself.
  feedbackInfo(TAG, "Starting minimal HTTP diagnostic server with ESP-IDF defaults");
  ESP_ERROR_CHECK(httpd_start(&server, &config));
  registerUri("/health", HTTP_GET, healthHandler);
  feedbackInfo(TAG, "Minimal HTTP diagnostic server started on port 80");
  return;
#else
  config.server_port = DEVICE_WEB_SERVER_PORT;
  config.ctrl_port = DEVICE_WEB_SERVER_CONTROL_PORT;
  config.stack_size = 16384;
  // WiFi and its event handlers are pinned to Core 0 on ESP32-S3.  Run the
  // device UI independently on Core 1 instead of letting the HTTP task race
  // the WiFi startup on the same core.
  config.core_id = 1;
  config.max_uri_handlers = 12;
  config.lru_purge_enable = true;
  config.uri_match_fn = httpd_uri_match_wildcard;

  feedbackInfo(TAG, "Starting device web server on Core 1");
  ESP_ERROR_CHECK(httpd_start(&server, &config));
  feedbackInfo(TAG, "Device web server task started; registering routes");
  registerUri("/", HTTP_GET, rootHandler);
  registerUri("/status", HTTP_GET, statusHandler);
  registerUri("/logs", HTTP_GET, logsHandler);
  registerUri("/wifi/scan", HTTP_GET, wifiScanHandler);
  registerUri("/wifi", HTTP_POST, wifiConnectHandler);
  registerUri("/provisioning", HTTP_POST, provisioningHandler);
  registerUri("/auth/challenge", HTTP_POST, challengeHandler);
  registerUri("/ota", HTTP_POST, otaHandler);
  registerUri("/*", HTTP_GET, captivePortalHandler);

  feedbackInfo(TAG, "Device web server started on port %u", DEVICE_WEB_SERVER_PORT);
#endif
}
