const fs = require("node:fs");
const path = require("node:path");
const { renderPlatformioIni } = require("../../../shared/platformio-config");

function templateFirmwareSources(template, title) {
  if (template?.id === "esp32_camera_to_touch_display") return cameraToTouchDisplaySources(template);
  if (!template?.realization?.buildConfig) return [];
  if (template.id === "touchscreen_game_collection") return touchscreenDemoSources();
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
    header(`${cameraRoot}/Komponenten/IoT-Device 1/src/camera_host_state.h`, cameraHostStateHeader()),
    source(`${cameraRoot}/Komponenten/IoT-Device 1/src/user_main.cpp`, cameraHostMain()),
    plain(`${displayRoot}/platformio.ini`, renderPlatformioIni(display.buildConfig), "build_config"),
    header(`${displayRoot}/Komponenten/IoT-Device 1/src/display_client_state.h`, displayClientStateHeader()),
    source(`${displayRoot}/Komponenten/IoT-Device 1/src/user_main.cpp`, displayClientMain()),
    plain("Docs/Kamera-zu-Display.md", cameraDisplayReadme()),
  ];
}

function cameraHostStateHeader() {
  return [
    "#pragma once",
    "",
    "enum class CameraHostStage {",
    "  basissoftware_ready,",
    "  camera_driver_pending,",
    "  frame_format_pending,",
    "  transport_pending,",
    "  ready,",
    "};",
    "",
    "struct CameraHostState {",
    "  CameraHostStage stage = CameraHostStage::basissoftware_ready;",
    "  bool board_configuration_available = true;",
    "};",
    "",
  ].join("\n");
}

function cameraHostMain() {
  return [
    '#include "user/user_app.h"',
    '#include "gernetix_board_configuration.h"',
    '#include "user_project/camera_host_state.h"',
    "",
    "namespace {",
    "CameraHostState state;",
    "}  // namespace",
    "",
    'extern "C" void userMain() {',
    "  // Die GerNetiX-Basissoftware hat WLAN, Provisioning, Status, OTA und Runtime gestartet.",
    "  // Naechster Schritt: OV3660 anhand der generierten GERNETIX_BOARD_FEATURE_CAMERA_* Werte initialisieren.",
    "  state.stage = CameraHostStage::camera_driver_pending;",
    "}",
    "",
    'extern "C" void userTick() {',
    "  // Spaetere Pipeline: Frame erfassen -> Format/Codec waehlen -> Transport an den Display-Client.",
    "  (void)state;",
    "}",
    "",
  ].join("\n");
}

function displayClientStateHeader() {
  return [
    "#pragma once",
    "",
    "enum class DisplayClientStage {",
    "  basissoftware_ready,",
    "  display_driver_pending,",
    "  transport_pending,",
    "  decoder_pending,",
    "  ready,",
    "};",
    "",
    "struct DisplayClientState {",
    "  DisplayClientStage stage = DisplayClientStage::basissoftware_ready;",
    "  bool board_configuration_available = true;",
    "};",
    "",
  ].join("\n");
}

function displayClientMain() {
  return [
    '#include "user/user_app.h"',
    '#include "gernetix_board_configuration.h"',
    '#include "user_project/display_client_state.h"',
    "",
    "namespace {",
    "DisplayClientState state;",
    "}  // namespace",
    "",
    'extern "C" void userMain() {',
    "  // Die GerNetiX-Basissoftware hat WLAN, Provisioning, Status, OTA und Runtime gestartet.",
    "  // Naechster Schritt: ILI9341 anhand der generierten GERNETIX_BOARD_FEATURE_DISPLAY_* Werte initialisieren.",
    "  state.stage = DisplayClientStage::display_driver_pending;",
    "}",
    "",
    'extern "C" void userTick() {',
    "  // Spaetere Pipeline: Bild empfangen -> Format dekodieren -> Frame auf dem Display ausgeben.",
    "  (void)state;",
    "}",
    "",
  ].join("\n");
}

function cameraDisplayReadme() {
  return [
    "# ESP32-Kamera auf Touchdisplay",
    "",
    "Das Projekt besitzt zwei unabhaengige Firmware-Ziele und baut deshalb immer beide Einheiten:",
    "",
    "1. `Software/Kamera-Host`: Waveshare ESP32-S3-CAM-OV3660 als kuenftiger Bild-Host.",
    "2. `Software/Display-Client`: ESP32-S3 ES3C28P als kuenftiger Display-Client.",
    "",
    "Beide Ziele beginnen mit der vollstaendigen GerNetiX-Basissoftware. Damit sind Provisioning, WLAN-Verwaltung, lokaler Status, Runtime, Diagnose und OTA bereits vorhanden. Die Hardwarekonfiguration jedes Boards wird beim Anlegen aus dem Hardware Catalog als Projektsnapshot uebernommen.",
    "",
    "## Geplante Ausbauschritte",
    "",
    "1. OV3660 initialisieren und ein einzelnes Rohbild erfassen.",
    "2. Ein geeignetes Bildformat beziehungsweise einen Codec festlegen.",
    "3. Den Bild-Host mit einem ersten lokalen Transport-Endpunkt erweitern.",
    "4. Den Display-Client verbinden und genau ein Bild empfangen.",
    "5. ILI9341 initialisieren und das empfangene Bild darstellen.",
    "6. Aus Einzelbildern eine stabile Bildfolge mit messbarer Bildrate machen.",
    "",
  ].join("\n");
}

function touchscreenDemoSources() {
  const root = path.resolve(__dirname, "../../../../Demoanwendungen/Boards/hardware.processor_board.esp32_s3_es3c28p/touch-spielesammlung/firmware");
  const files = ["platformio.ini", ...fs.readdirSync(path.join(root, "src")).sort().map((name) => `src/${name}`)];
  return files.map((relativePath) => ({
    path: relativePath,
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
