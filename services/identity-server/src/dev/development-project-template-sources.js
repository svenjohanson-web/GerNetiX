const fs = require("node:fs");
const path = require("node:path");
const { renderPlatformioIni } = require("../../../shared/platformio-config");

function templateFirmwareSources(template, title) {
  if (template?.id === "esp32_camera_to_touch_display") return cameraToTouchDisplaySources(template);
  if (template.id === "touchscreen_game_collection") return touchscreenDemoSources();
  if (!template?.realization?.buildConfig) return [];
  return [{
    path: "Komponenten/IoT-Device 1/src/user_main.cpp",
    role: "user_code",
    content_type: "text/x-c++src",
    content: [
      '#include "user/user_app.h"',
      "",
      'extern "C" void userMain() {',
      `  // Projektstart: ${String(title || template.title).replace(/["\\]/g, "")}`,
      "}",
      "",
      'extern "C" void userTick() {',
      "  // Wiederkehrende Nutzerlogik wird von der Basissoftware aufgerufen.",
      "}",
      "",
    ].join("\n"),
  }];
}

function cameraToTouchDisplaySources(template) {
  const units = template.realization.softwareUnits;
  const camera = units.find((unit) => unit.software_unit_id === "camera_sender");
  const display = units.find((unit) => unit.software_unit_id === "display_receiver");
  const cameraRoot = camera.source_root;
  const displayRoot = display.source_root;
  return [
    plain(`${cameraRoot}/platformio.ini`, renderPlatformioIni(camera.buildConfig), "build_config"),
    plain(`${cameraRoot}/src/idf_component.yml`, cameraDisplayComponentManifest(), "build_config"),
    header(`${cameraRoot}/include/camera_host_state.h`, cameraHostStateHeader()),
    source(`${cameraRoot}/src/user_main.cpp`, cameraHostMain()),
    plain(`${displayRoot}/platformio.ini`, renderPlatformioIni(display.buildConfig), "build_config"),
    plain(`${displayRoot}/src/idf_component.yml`, cameraDisplayComponentManifest(), "build_config"),
    header(`${displayRoot}/include/display_client_state.h`, displayClientStateHeader()),
    source(`${displayRoot}/src/user_main.cpp`, displayClientMain()),
    plain("Architektur/Kamera-zu-Display.md", cameraDisplayReadme()),
  ];
}

function cameraDisplayComponentManifest() {
  return [
    "dependencies:",
    '  espressif/mqtt: "^1.0.0"',
    '  espressif/esp32-camera: "2.1.7"',
    '  espressif/mdns: "1.11.3"',
    "",
  ].join("\n");
}

function cameraHostStateHeader() {
  return [
    "#pragma once",
    "",
    "enum class CameraHostStage {",
    "  basissoftware_ready,",
    "  starting_camera,",
    "  starting_http_server,",
    "  ready,",
    "};",
    "",
    "struct CameraHostState {",
    "  CameraHostStage stage = CameraHostStage::basissoftware_ready;",
    "  unsigned long frames_sent = 0;",
    "  int last_error = 0;",
    "};",
    "",
  ].join("\n");
}

function cameraHostMain() {
  return String.raw`#include "user/user_app.h"
#include "gernetix_basissoftware_configuration.h"
#include "gernetix_board_configuration.h"
#include "user_project/camera_host_state.h"

#include <cstdio>
#include <cstring>

#include "driver/i2c.h"
#include "esp_camera.h"
#include "esp_http_server.h"
#include "esp_log.h"
#include "mdns.h"

#if !defined(GERNETIX_BOARD_FEATURE_CAMERA_PIN_XCLK) || !defined(GERNETIX_BOARD_FEATURE_CAMERA_PIN_D0) || !defined(GERNETIX_BOARD_FEATURE_CAMERA_PIN_PCLK)
#error "Die Kamera-Pins fehlen im GerNetiX-Board-Snapshot."
#endif
#if !defined(GERNETIX_BOARD_FEATURE_CAMERA_POWER_PIN_SDA) || !defined(GERNETIX_BOARD_FEATURE_CAMERA_POWER_PIN_SCL) || !defined(GERNETIX_BOARD_FEATURE_CAMERA_POWER_PIN_ADDRESS) || !defined(GERNETIX_BOARD_FEATURE_CAMERA_POWER_PIN_OUTPUT)
#error "Die Waveshare-Kameraversorgung fehlt im GerNetiX-Board-Snapshot."
#endif

namespace {
constexpr char TAG[] = "camera-host";
constexpr char STREAM_TYPE[] = "multipart/x-mixed-replace;boundary=frame";
constexpr char STREAM_BOUNDARY[] = "--frame\r\n";
constexpr char STREAM_HEADER[] = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";
CameraHostState state;
httpd_handle_t cameraServer = nullptr;

esp_err_t sendJpegFrame(httpd_req_t *request, bool multipart) {
  camera_fb_t *frame = esp_camera_fb_get();
  if (frame == nullptr || frame->format != PIXFORMAT_JPEG) {
    if (frame != nullptr) esp_camera_fb_return(frame);
    state.last_error = ESP_FAIL;
    return ESP_FAIL;
  }
  esp_err_t result = ESP_OK;
  if (multipart) {
    char header[96] = {};
    const int length = std::snprintf(header, sizeof(header), STREAM_HEADER, static_cast<unsigned>(frame->len));
    result = httpd_resp_send_chunk(request, STREAM_BOUNDARY, HTTPD_RESP_USE_STRLEN);
    if (result == ESP_OK) result = httpd_resp_send_chunk(request, header, length);
    if (result == ESP_OK) result = httpd_resp_send_chunk(request, reinterpret_cast<const char *>(frame->buf), frame->len);
    if (result == ESP_OK) result = httpd_resp_send_chunk(request, "\r\n", 2);
  } else {
    httpd_resp_set_type(request, "image/jpeg");
    httpd_resp_set_hdr(request, "Cache-Control", "no-store");
    result = httpd_resp_send(request, reinterpret_cast<const char *>(frame->buf), frame->len);
  }
  esp_camera_fb_return(frame);
  if (result == ESP_OK) state.frames_sent++;
  return result;
}

esp_err_t frameHandler(httpd_req_t *request) {
  return sendJpegFrame(request, false);
}

esp_err_t streamHandler(httpd_req_t *request) {
  esp_err_t result = httpd_resp_set_type(request, STREAM_TYPE);
  httpd_resp_set_hdr(request, "Cache-Control", "no-store");
  while (result == ESP_OK) result = sendJpegFrame(request, true);
  return result;
}

bool enableIntegratedCamera() {
  constexpr i2c_port_t port = I2C_NUM_0;
  i2c_config_t bus = {};
  bus.mode = I2C_MODE_MASTER;
  bus.sda_io_num = static_cast<gpio_num_t>(GERNETIX_BOARD_FEATURE_CAMERA_POWER_PIN_SDA);
  bus.scl_io_num = static_cast<gpio_num_t>(GERNETIX_BOARD_FEATURE_CAMERA_POWER_PIN_SCL);
  bus.sda_pullup_en = GPIO_PULLUP_ENABLE;
  bus.scl_pullup_en = GPIO_PULLUP_ENABLE;
  bus.master.clk_speed = 400000;

  esp_err_t result = i2c_param_config(port, &bus);
  bool driverInstalled = false;
  if (result == ESP_OK) {
    result = i2c_driver_install(port, bus.mode, 0, 0, 0);
    driverInstalled = result == ESP_OK;
  }
  if (result == ESP_OK) {
    const uint8_t mode[] = { 0x02, 0xFF };
    result = i2c_master_write_to_device(
        port,
        GERNETIX_BOARD_FEATURE_CAMERA_POWER_PIN_ADDRESS,
        mode,
        sizeof(mode),
        pdMS_TO_TICKS(100));
  }
  if (result == ESP_OK) {
    const uint8_t output[] = {
      0x03,
      static_cast<uint8_t>(1U << GERNETIX_BOARD_FEATURE_CAMERA_POWER_PIN_OUTPUT),
    };
    result = i2c_master_write_to_device(
        port,
        GERNETIX_BOARD_FEATURE_CAMERA_POWER_PIN_ADDRESS,
        output,
        sizeof(output),
        pdMS_TO_TICKS(100));
  }
  if (driverInstalled) i2c_driver_delete(port);
  state.last_error = result;
  if (result != ESP_OK) {
    ESP_LOGE(TAG, "CH32V003-Kameraausgang konnte nicht aktiviert werden: %d", result);
    return false;
  }
  vTaskDelay(pdMS_TO_TICKS(20));
  return true;
}

bool startCamera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = GERNETIX_BOARD_FEATURE_CAMERA_PIN_D0;
  config.pin_d1 = GERNETIX_BOARD_FEATURE_CAMERA_PIN_D1;
  config.pin_d2 = GERNETIX_BOARD_FEATURE_CAMERA_PIN_D2;
  config.pin_d3 = GERNETIX_BOARD_FEATURE_CAMERA_PIN_D3;
  config.pin_d4 = GERNETIX_BOARD_FEATURE_CAMERA_PIN_D4;
  config.pin_d5 = GERNETIX_BOARD_FEATURE_CAMERA_PIN_D5;
  config.pin_d6 = GERNETIX_BOARD_FEATURE_CAMERA_PIN_D6;
  config.pin_d7 = GERNETIX_BOARD_FEATURE_CAMERA_PIN_D7;
  config.pin_xclk = GERNETIX_BOARD_FEATURE_CAMERA_PIN_XCLK;
  config.pin_pclk = GERNETIX_BOARD_FEATURE_CAMERA_PIN_PCLK;
  config.pin_vsync = GERNETIX_BOARD_FEATURE_CAMERA_PIN_VSYNC;
  config.pin_href = GERNETIX_BOARD_FEATURE_CAMERA_PIN_HREF;
  config.pin_sccb_sda = GERNETIX_BOARD_FEATURE_CAMERA_PIN_SCCB_SDA;
  config.pin_sccb_scl = GERNETIX_BOARD_FEATURE_CAMERA_PIN_SCCB_SCL;
  config.pin_pwdn = GERNETIX_BOARD_FEATURE_CAMERA_PIN_PWDN;
  config.pin_reset = GERNETIX_BOARD_FEATURE_CAMERA_PIN_RESET;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_QVGA;
  config.jpeg_quality = 12;
  config.fb_count = 2;
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  const esp_err_t result = esp_camera_init(&config);
  state.last_error = result;
  if (result != ESP_OK) ESP_LOGE(TAG, "OV3660 konnte nicht initialisiert werden: %d", result);
  return result == ESP_OK;
}

bool startHttpServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = GERNETIX_COMMUNICATION_ENDPOINT_PORT;
  config.ctrl_port = 32770;
  config.max_uri_handlers = 4;
  if (httpd_start(&cameraServer, &config) != ESP_OK) return false;
  const httpd_uri_t stream = { .uri = GERNETIX_COMMUNICATION_ENDPOINT_PATH, .method = HTTP_GET, .handler = streamHandler, .user_ctx = nullptr };
  const httpd_uri_t frame = { .uri = "/camera/frame", .method = HTTP_GET, .handler = frameHandler, .user_ctx = nullptr };
  return httpd_register_uri_handler(cameraServer, &stream) == ESP_OK
      && httpd_register_uri_handler(cameraServer, &frame) == ESP_OK;
}
}  // namespace

extern "C" void userMain() {
  state.stage = CameraHostStage::starting_camera;
  if (!enableIntegratedCamera() || !startCamera()) return;
  state.stage = CameraHostStage::starting_http_server;
  if (mdns_init() == ESP_OK) {
    mdns_hostname_set(GERNETIX_COMMUNICATION_LOCAL_HOSTNAME);
    mdns_instance_name_set("GerNetiX Kamera-Host");
  }
  if (!startHttpServer()) {
    state.last_error = ESP_FAIL;
    return;
  }
  state.stage = CameraHostStage::ready;
  ESP_LOGI(TAG, "MJPEG bereit: Port %d, Pfad %s", GERNETIX_COMMUNICATION_ENDPOINT_PORT, GERNETIX_COMMUNICATION_ENDPOINT_PATH);
}

extern "C" void userTick() {
  // Der HTTP-Server und der Kameratreiber arbeiten in ihren ESP-IDF-Tasks.
}
`;
}

function displayClientStateHeader() {
  return [
    "#pragma once",
    "",
    "enum class DisplayClientStage {",
    "  basissoftware_ready,",
    "  starting_display,",
    "  waiting_for_camera,",
    "  ready,",
    "};",
    "",
    "struct DisplayClientState {",
    "  DisplayClientStage stage = DisplayClientStage::basissoftware_ready;",
    "  unsigned long frames_drawn = 0;",
    "  int last_error = 0;",
    "};",
    "",
  ].join("\n");
}

function displayClientMain() {
  return String.raw`#include "user/user_app.h"
#include "gernetix_basissoftware_configuration.h"
#include "gernetix_board_configuration.h"
#include "user_project/display_client_state.h"

#include <cstdio>
#include <cstring>

#include "driver/gpio.h"
#include "driver/spi_master.h"
#include "esp_heap_caps.h"
#include "esp_http_client.h"
#include "esp_lcd_io_spi.h"
#include "esp_lcd_panel_io.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "img_converters.h"

#if !defined(GERNETIX_BOARD_FEATURE_DISPLAY_PIN_MOSI) || !defined(GERNETIX_BOARD_FEATURE_DISPLAY_PIN_SCLK) || !defined(GERNETIX_BOARD_FEATURE_DISPLAY_PIN_CS)
#error "Die Display-Pins fehlen im GerNetiX-Board-Snapshot."
#endif

namespace {
constexpr char TAG[] = "display-client";
constexpr int DISPLAY_WIDTH = 320;
constexpr int DISPLAY_HEIGHT = 240;
constexpr size_t RGB_BYTES = DISPLAY_WIDTH * DISPLAY_HEIGHT * 3;
constexpr size_t MAX_JPEG_BYTES = 256 * 1024;
DisplayClientState state;
esp_lcd_panel_io_handle_t displayIo = nullptr;
uint8_t *jpegBuffer = nullptr;
uint8_t *rgbBuffer = nullptr;
uint16_t *displayLineBuffer = nullptr;
int64_t lastFrameAttemptUs = 0;

struct Download {
  uint8_t *data;
  size_t capacity;
  size_t length;
  bool overflow;
};

esp_err_t httpEvent(esp_http_client_event_t *event) {
  Download *download = static_cast<Download *>(event->user_data);
  if (event->event_id != HTTP_EVENT_ON_DATA || download == nullptr || event->data_len <= 0) return ESP_OK;
  if (download->length + static_cast<size_t>(event->data_len) > download->capacity) {
    download->overflow = true;
    return ESP_FAIL;
  }
  std::memcpy(download->data + download->length, event->data, event->data_len);
  download->length += event->data_len;
  return ESP_OK;
}

void command(uint8_t value, const void *data = nullptr, size_t length = 0) {
  ESP_ERROR_CHECK(esp_lcd_panel_io_tx_param(displayIo, value, data, length));
}

bool startDisplay() {
  spi_bus_config_t bus = {};
  bus.sclk_io_num = GERNETIX_BOARD_FEATURE_DISPLAY_PIN_SCLK;
  bus.mosi_io_num = GERNETIX_BOARD_FEATURE_DISPLAY_PIN_MOSI;
  bus.miso_io_num = GERNETIX_BOARD_FEATURE_DISPLAY_PIN_MISO;
  bus.quadwp_io_num = -1;
  bus.quadhd_io_num = -1;
  bus.max_transfer_sz = DISPLAY_WIDTH * 2;
  if (spi_bus_initialize(SPI2_HOST, &bus, SPI_DMA_CH_AUTO) != ESP_OK) return false;

  esp_lcd_panel_io_spi_config_t io = {};
  io.cs_gpio_num = GERNETIX_BOARD_FEATURE_DISPLAY_PIN_CS;
  io.dc_gpio_num = GERNETIX_BOARD_FEATURE_DISPLAY_PIN_DC;
  io.spi_mode = 0;
  io.pclk_hz = 27000000;
  io.trans_queue_depth = 2;
  io.lcd_cmd_bits = 8;
  io.lcd_param_bits = 8;
  if (esp_lcd_new_panel_io_spi(SPI2_HOST, &io, &displayIo) != ESP_OK) return false;

  gpio_config_t backlight = {};
  backlight.pin_bit_mask = 1ULL << GERNETIX_BOARD_FEATURE_DISPLAY_PIN_BACKLIGHT;
  backlight.mode = GPIO_MODE_OUTPUT;
  gpio_config(&backlight);
  gpio_set_level(static_cast<gpio_num_t>(GERNETIX_BOARD_FEATURE_DISPLAY_PIN_BACKLIGHT), 0);

  command(0x01);
  vTaskDelay(pdMS_TO_TICKS(120));
  const uint8_t powerControl1 = 0x23;
  const uint8_t powerControl2 = 0x10;
  const uint8_t vcomControl1[] = { 0x3E, 0x28 };
  const uint8_t vcomControl2 = 0x86;
  const uint8_t pixelFormat = 0x55;
  const uint8_t memoryAccess = 0x28;
  const uint8_t frameRate[] = { 0x00, 0x18 };
  const uint8_t displayFunction[] = { 0x08, 0x82, 0x27 };
  command(0xC0, &powerControl1, 1);
  command(0xC1, &powerControl2, 1);
  command(0xC5, vcomControl1, sizeof(vcomControl1));
  command(0xC7, &vcomControl2, 1);
  command(0x3A, &pixelFormat, 1);
  command(0x36, &memoryAccess, 1);
  command(0xB1, frameRate, sizeof(frameRate));
  command(0xB6, displayFunction, sizeof(displayFunction));
  command(0x21);
  command(0x11);
  vTaskDelay(pdMS_TO_TICKS(120));
  command(0x29);
  gpio_set_level(static_cast<gpio_num_t>(GERNETIX_BOARD_FEATURE_DISPLAY_PIN_BACKLIGHT), 1);
  return true;
}

bool downloadFrame() {
  char url[192] = {};
#if GERNETIX_COMMUNICATION_DEVICE_ACCESS_POINT == 1
  std::snprintf(url, sizeof(url), "http://%s:%d/camera/frame", GERNETIX_ACCESS_POINT_IPV4_ADDRESS, GERNETIX_COMMUNICATION_ENDPOINT_PORT);
#else
  std::snprintf(url, sizeof(url), "http://%s.local:%d/camera/frame", GERNETIX_COMMUNICATION_PEER_HOSTNAME, GERNETIX_COMMUNICATION_ENDPOINT_PORT);
#endif
  Download download = { jpegBuffer, MAX_JPEG_BYTES, 0, false };
  esp_http_client_config_t config = {};
  config.url = url;
  config.event_handler = httpEvent;
  config.user_data = &download;
  config.timeout_ms = 4000;
  config.buffer_size = 4096;
  esp_http_client_handle_t client = esp_http_client_init(&config);
  if (client == nullptr) return false;
  const esp_err_t result = esp_http_client_perform(client);
  const int status = esp_http_client_get_status_code(client);
  esp_http_client_cleanup(client);
  if (result != ESP_OK || status != 200 || download.overflow || download.length == 0) {
    state.last_error = result == ESP_OK ? ESP_FAIL : result;
    return false;
  }
  return fmt2rgb888(jpegBuffer, download.length, PIXFORMAT_JPEG, rgbBuffer);
}

void drawRgbFrame() {
  uint8_t xRange[] = { 0, 0, static_cast<uint8_t>((DISPLAY_WIDTH - 1) >> 8), static_cast<uint8_t>(DISPLAY_WIDTH - 1) };
  command(0x2A, xRange, sizeof(xRange));
  for (int y = 0; y < DISPLAY_HEIGHT; y++) {
    const uint8_t *source = rgbBuffer + (y * DISPLAY_WIDTH * 3);
    for (int x = 0; x < DISPLAY_WIDTH; x++) {
      const uint16_t rgb565 = static_cast<uint16_t>(((source[x * 3] & 0xF8) << 8)
          | ((source[x * 3 + 1] & 0xFC) << 3) | (source[x * 3 + 2] >> 3));
      displayLineBuffer[x] = static_cast<uint16_t>((rgb565 << 8) | (rgb565 >> 8));
    }
    uint8_t yRange[] = { static_cast<uint8_t>(y >> 8), static_cast<uint8_t>(y), static_cast<uint8_t>(y >> 8), static_cast<uint8_t>(y) };
    command(0x2B, yRange, sizeof(yRange));
    ESP_ERROR_CHECK(esp_lcd_panel_io_tx_color(
        displayIo,
        0x2C,
        displayLineBuffer,
        DISPLAY_WIDTH * sizeof(uint16_t)));
  }
  state.frames_drawn++;
}
}  // namespace

extern "C" void userMain() {
  state.stage = DisplayClientStage::starting_display;
  jpegBuffer = static_cast<uint8_t *>(heap_caps_malloc(MAX_JPEG_BYTES, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  rgbBuffer = static_cast<uint8_t *>(heap_caps_malloc(RGB_BYTES, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  displayLineBuffer = static_cast<uint16_t *>(heap_caps_malloc(
      DISPLAY_WIDTH * sizeof(uint16_t),
      MALLOC_CAP_DMA | MALLOC_CAP_INTERNAL));
  if (jpegBuffer == nullptr || rgbBuffer == nullptr || displayLineBuffer == nullptr || !startDisplay()) {
    state.last_error = ESP_ERR_NO_MEM;
    ESP_LOGE(TAG, "Display oder PSRAM-Puffer konnten nicht initialisiert werden");
    return;
  }
  state.stage = DisplayClientStage::waiting_for_camera;
}

extern "C" void userTick() {
  if (jpegBuffer == nullptr || rgbBuffer == nullptr) return;
  const int64_t now = esp_timer_get_time();
  if (now - lastFrameAttemptUs < 150000) return;
  lastFrameAttemptUs = now;
  if (!downloadFrame()) return;
  drawRgbFrame();
  state.stage = DisplayClientStage::ready;
  state.last_error = ESP_OK;
}
`;
}

function cameraDisplayReadme() {
  return [
    "# ESP32-Kamera auf Touchdisplay",
    "",
    "Das Projekt besitzt zwei unabhaengige Firmware-Ziele und baut deshalb immer beide Einheiten:",
    "",
    "1. `Komponenten/IoT-Device 1/src`: Software des Waveshare ESP32-S3-CAM-OV3660 als kuenftiger Bild-Host.",
    "2. `Komponenten/IoT-Device 2/src`: Software des ESP32-S3 ES3C28P als kuenftiger Display-Client.",
    "",
    "Beide Ziele beginnen mit der vollstaendigen GerNetiX-Basissoftware. Damit sind WLAN-Verwaltung, lokaler Status, Runtime, Diagnose und OTA bereits vorhanden. Die Hardwarekonfiguration jedes Boards wird beim Anlegen aus dem Hardware Catalog als Projektsnapshot uebernommen.",
    "",
    "## Umgesetzter Durchstich",
    "",
    "1. Der Kamera-Host initialisiert die OV3660 ausschliesslich mit den Pins seines generierten Board-Snapshots.",
    "2. Die Kamera liefert QVGA-Bilder bereits als JPEG. Es werden keine Bilder gespeichert.",
    "3. Der Host stellt den lokalen MJPEG-Endpunkt aus dem Kommunikationssetup sowie `/camera/frame` fuer Einzelbilder bereit.",
    "4. Der Display-Client ruft JPEG-Einzelbilder per HTTP ab, dekodiert sie im PSRAM und zeichnet sie ueber den konfigurierten ILI9341-SPI-Bus.",
    "",
    "MQTT ist fuer diesen Datenweg deaktiviert. Im voreingestellten Geräte-AP-Modus nutzt der Client die konfigurierte AP-IP; im Haus-WLAN wird der Kamera-Host per lokalem mDNS-Namen gefunden.",
    "",
    "> Der HTTP-Bildstrom ist ein lokaler Entwicklungs-Durchstich ohne Benutzeranmeldung und darf nicht per Portweiterleitung oder öffentlichem Reverse Proxy ins Internet gestellt werden.",
    "",
  ].join("\n");
}

function touchscreenDemoSources() {
  const root = path.resolve(__dirname, "../../../../Demoanwendungen/Boards/hardware.processor_board.esp32_s3_es3c28p/touch-spielesammlung/firmware");
  const files = ["platformio.ini", ...fs.readdirSync(path.join(root, "src")).sort().map((name) => `src/${name}`)];
  return files.map((relativePath) => ({
    path: `Komponenten/IoT-Device 1/${relativePath.endsWith(".h") ? relativePath.replace(/^src\//, "include/") : relativePath}`,
    role: "user_code",
    content_type: relativePath.endsWith(".h") ? "text/x-c++hdr" : relativePath.endsWith(".ini") ? "text/plain" : "text/x-c++src",
    content: fs.readFileSync(path.join(root, relativePath), "utf8"),
  }));
}

function touchscreenGameSources(title) {
  const root = "Komponenten/IoT-Device 1/src";
  const games = [
    ["nibbles", "Nibbles", "Raster, Hindernisse und wachsende Spielfigur aktualisieren."],
    ["snake", "Snake", "Schlange bewegen, Futter pruefen und Kollisionen erkennen."],
    ["frogger", "Frogger", "Frosch, Fahrspuren und sichere Zielzonen aktualisieren."],
    ["tic_tac_toe", "Tic-Tac-Toe", "Touch-Feld bestimmen, Zug pruefen und Gewinner erkennen."],
    ["pong", "Pong", "Ballphysik und Touch-Schlaeger aktualisieren."],
    ["breakout", "Breakout", "Ball, Schlaeger und verbleibende Bloecke aktualisieren."],
    ["memory", "Memory", "Karten aufdecken, Paare vergleichen und Zuege zaehlen."],
  ];
  return [
    source(`${root}/user_main.cpp`, [
      '#include "user/user_app.h"',
      '#include "user_project/config/selected_games.h"',
      '#include "user_project/game/game_contract.h"',
      '#include "user_project/view/start_screen.h"',
      '#include "user_project/games/nibbles.h"',
      '#include "user_project/games/snake.h"',
      '#include "user_project/games/frogger.h"',
      '#include "user_project/games/tic_tac_toe.h"',
      '#include "user_project/games/pong.h"',
      '#include "user_project/games/breakout.h"',
      '#include "user_project/games/memory.h"',
      "",
      "namespace {",
      "constexpr int MAX_GAMES = 7;",
      "game_app::GameDescriptor customerGames[MAX_GAMES];",
      "game_app::StartScreen startScreen;",
      "int gameCount = 0;",
      "int activeGame = -1;",
      "uint32_t frameNumber = 0;",
      "",
      "int registerCustomerGames() {",
      "  int count = 0;",
      "#if GNX_GAME_NIBBLES_ENABLED",
      '  customerGames[count++] = {"nibbles", "Nibbles", games::nibbles::reset, games::nibbles::update, games::nibbles::render};',
      "#endif",
      "#if GNX_GAME_SNAKE_ENABLED",
      '  customerGames[count++] = {"snake", "Snake", games::snake::reset, games::snake::update, games::snake::render};',
      "#endif",
      "#if GNX_GAME_FROGGER_ENABLED",
      '  customerGames[count++] = {"frogger", "Frogger", games::frogger::reset, games::frogger::update, games::frogger::render};',
      "#endif",
      "#if GNX_GAME_TIC_TAC_TOE_ENABLED",
      '  customerGames[count++] = {"tic_tac_toe", "Tic-Tac-Toe", games::tic_tac_toe::reset, games::tic_tac_toe::update, games::tic_tac_toe::render};',
      "#endif",
      "#if GNX_GAME_PONG_ENABLED",
      '  customerGames[count++] = {"pong", "Pong", games::pong::reset, games::pong::update, games::pong::render};',
      "#endif",
      "#if GNX_GAME_BREAKOUT_ENABLED",
      '  customerGames[count++] = {"breakout", "Breakout", games::breakout::reset, games::breakout::update, games::breakout::render};',
      "#endif",
      "#if GNX_GAME_MEMORY_ENABLED",
      '  customerGames[count++] = {"memory", "Memory", games::memory::reset, games::memory::update, games::memory::render};',
      "#endif",
      "  return count;",
      "}",
      "",
      "game_app::TouchEvent readTouch() {",
      "  // Boardadapter anbinden: Touchcontroller auslesen und kalibrierte Koordinaten liefern.",
      "  return {false, 0, 0};",
      "}",
      "}  // namespace",
      "",
      'extern "C" void userMain() {',
      `  // Projektstart: ${String(title).replace(/["\\]/g, "")}`,
      "  // Alle Spiele werden hier, in der Kunden-Main, sichtbar eingebunden und registriert.",
      "  gameCount = registerCustomerGames();",
      "  startScreen.render(customerGames, gameCount);",
      "}",
      "",
      'extern "C" void userTick() {',
      "  const game_app::GameFrame frame = {frameNumber++, 16, readTouch()};",
      "  if (activeGame < 0) {",
      "    const int selection = startScreen.handleTouch(frame.touch, gameCount);",
      "    if (selection >= 0) { activeGame = selection; customerGames[activeGame].reset(); }",
      "    startScreen.render(customerGames, gameCount);",
      "    return;",
      "  }",
      "  customerGames[activeGame].update(frame);",
      "  customerGames[activeGame].render();",
      "}",
      "",
    ].join("\n")),
    header(`${root}/game/game_contract.h`, [
      "#pragma once",
      "#include <stdint.h>",
      "namespace game_app {",
      "struct TouchEvent { bool pressed; int16_t x; int16_t y; };",
      "struct GameFrame { uint32_t frame_number; uint32_t elapsed_ms; TouchEvent touch; };",
      "struct GameDescriptor { const char* id; const char* title; void (*reset)(); void (*update)(const GameFrame&); void (*render)(); };",
      "}",
      "",
    ].join("\n")),
    header(`${root}/view/start_screen.h`, [
      "#pragma once",
      '#include "user_project/game/game_contract.h"',
      "namespace game_app {",
      "class StartScreen {",
      " public:",
      "  StartScreen() : selected_(0) {}",
      "  int selected() const { return selected_; }",
      "  int handleTouch(const TouchEvent& touch, int game_count) {",
      "    if (!touch.pressed || game_count <= 0) return -1;",
      "    selected_ = (touch.y / 48) % game_count;",
      "    return selected_;",
      "  }",
      "  void render(const GameDescriptor* games, int game_count) const {",
      "    // View-Schicht: Titel und Touch-Auswahl rendern. Keine Spiellogik hier ablegen.",
      "    (void)games; (void)game_count;",
      "  }",
      " private:",
      "  int selected_;",
      "};",
      "}",
      "",
    ].join("\n")),
    header(`${root}/config/selected_games.h`, selectedGamesHeader(["nibbles", "frogger"])),
    ...games.map(([id, name, update]) => header(`${root}/games/${id}.h`, gameExampleHeader(id, name, update))),
  ];
}

function gameExampleHeader(id, name, updateText) {
  return [
    "#pragma once",
    '#include "user_project/game/game_contract.h"',
    `namespace games { namespace ${id} {`,
    "struct State { int score; bool running; };",
    "inline State& state() { static State value = {0, true}; return value; }",
    "inline void reset() { state() = {0, true}; }",
    `inline void update(const game_app::GameFrame& frame) { (void)frame; /* ${updateText} */ }`,
    `inline void render() { /* ${name}: Spielzustand ueber den Board-Displayadapter zeichnen. */ }`,
    `} }  // namespace games::${id}`,
    "",
  ].join("\n");
}

function selectedGamesHeader(selectedGameIds) {
  const selected = new Set(selectedGameIds);
  return [
    "#pragma once",
    "// Diese Datei wird aus der Spielkonfiguration erzeugt.",
    ...["nibbles", "snake", "frogger", "tic_tac_toe", "pong", "breakout", "memory"]
      .map((id) => `#define GNX_GAME_${id.toUpperCase()}_ENABLED ${selected.has(id) ? 1 : 0}`),
    "",
  ].join("\n");
}

function mergeSelectedGamesHeader(selectedGameIds, existingContent = "") {
  const builtInMacros = new Set(["nibbles", "snake", "frogger", "tic_tac_toe", "pong", "breakout", "memory"]
    .map((id) => `GNX_GAME_${id.toUpperCase()}_ENABLED`));
  const customDefinitions = [...String(existingContent).matchAll(/^#define\s+(GNX_GAME_[A-Z][A-Z0-9_]{0,48}_ENABLED)\s+([01])\s*$/gm)]
    .map((match) => ({ macro: match[1], enabled: match[2] }))
    .filter((definition) => !builtInMacros.has(definition.macro))
    .filter((definition, index, items) => items.findIndex((item) => item.macro === definition.macro) === index)
    .slice(0, 24);
  const builtIns = selectedGamesHeader(selectedGameIds).trimEnd();
  if (!customDefinitions.length) return `${builtIns}\n`;
  return [
    builtIns,
    "",
    "// Benutzerdefinierte Spiele werden vom bestaetigten IDE-KI-Workflow gepflegt.",
    ...customDefinitions.map((definition) => `#define ${definition.macro} ${definition.enabled}`),
    "",
  ].join("\n");
}

function source(path, content) {
  return { path, role: "user_code", content_type: "text/x-c++src", content };
}

function header(path, content) {
  return { path, role: "user_code", content_type: "text/x-c++hdr", content };
}

function plain(path, content, role = "documentation") {
  return { path, role, content_type: "text/plain", content };
}

module.exports = { mergeSelectedGamesHeader, selectedGamesHeader, templateFirmwareSources };
