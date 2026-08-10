function templateFirmwareSources(template, title) {
  // Product templates are materialized by Project Server from their pinned
  // Forgejo source. Keeping a second local copy here would make the demo
  // directory an accidental source of truth again.
  if (template?.realization?.systemSourceId) return [];
  if (template.id === "ai_board_playground") return boardPlaygroundSources(title);
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

function boardPlaygroundSources(title) {
  const safeTitle = String(title || "Meine Board-Spielwiese").replace(/["\\]/g, "");
  return [
    {
      path: "Komponenten/IoT-Device 1/src/user_main.cpp",
      role: "user_code",
      content_type: "text/x-c++src",
      content: [
        '#include "user/user_app.h"',
        '#include "gernetix_board_configuration.h"',
        "",
        'extern "C" void userMain() {',
        `  // ${safeTitle}: Hier beginnt dein erstes KI-gestütztes Board-Experiment.`,
        "  // Die GerNetiX-Basissoftware bleibt unverändert und ruft diese Funktion auf.",
        "}",
        "",
        'extern "C" void userTick() {',
        "  // Wiederkehrende Projektlogik kommt nach deiner Bestätigung hier hinein.",
        "}",
        "",
      ].join("\n"),
    },
    {
      path: "README.md",
      role: "documentation",
      content_type: "text/markdown",
      content: [
        `# ${safeTitle}`,
        "",
        "Dieses Spielprojekt ist an den beim Anlegen gespeicherten Board-Snapshot gebunden.",
        "Die GerNetiX-KI darf Projektdateien suchen und lesen, Änderungen vorschlagen und nach deiner Bestätigung übernehmen.",
        "Basissoftware, Secrets, Flashen und produktive Systeme bleiben außerhalb ihres Schreibbereichs.",
        "",
      ].join("\n"),
    },
  ];
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
