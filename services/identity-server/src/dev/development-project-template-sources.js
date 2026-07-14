function templateFirmwareSources(template, title) {
  if (!template?.realization?.buildConfig) return [];
  if (template.id === "touchscreen_game_collection") return touchscreenGameSources(title || template.title);
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
      '#include "user_project/game_application.h"',
      "",
      "static game_app::GameApplication application;",
      "",
      'extern "C" void userMain() {',
      `  // Projektstart: ${String(title).replace(/["\\]/g, "")}`,
      "  application.begin();",
      "}",
      "",
      'extern "C" void userTick() {',
      "  application.tick();",
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
    header(`${root}/config/selected_games.h`, selectedGamesHeader(["nibbles", "snake", "frogger", "tic_tac_toe"])),
    ...games.map(([id, name, update]) => header(`${root}/games/${id}.h`, gameExampleHeader(id, name, update))),
    header(`${root}/game/game_catalog.h`, gameCatalogHeader(games)),
    header(`${root}/game_application.h`, gameApplicationHeader()),
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

function gameCatalogHeader(games) {
  return [
    "#pragma once",
    '#include "user_project/config/selected_games.h"',
    '#include "user_project/game/game_contract.h"',
    ...games.map(([id]) => `#include "user_project/games/${id}.h"`),
    "namespace game_app {",
    "inline int createGameCatalog(GameDescriptor* target, int capacity) {",
    "  int count = 0;",
    ...games.flatMap(([id, title]) => [
      `#if GNX_GAME_${id.toUpperCase()}_ENABLED`,
      `  if (count < capacity) target[count++] = {"${id}", "${title}", games::${id}::reset, games::${id}::update, games::${id}::render};`,
      "#endif",
    ]),
    "  return count;",
    "}",
    "}",
    "",
  ].join("\n");
}

function gameApplicationHeader() {
  return [
    "#pragma once",
    '#include "user_project/game/game_catalog.h"',
    '#include "user_project/view/start_screen.h"',
    "namespace game_app {",
    "class GameApplication {",
    " public:",
    "  GameApplication() : game_count_(0), active_game_(-1), frame_number_(0) {}",
    "  void begin() { game_count_ = createGameCatalog(games_, 8); start_screen_.render(games_, game_count_); }",
    "  void tick() {",
    "    GameFrame frame = {frame_number_++, 16, readTouch()};",
    "    if (active_game_ < 0) {",
    "      const int selection = start_screen_.handleTouch(frame.touch, game_count_);",
    "      if (selection >= 0) { active_game_ = selection; games_[active_game_].reset(); }",
    "      start_screen_.render(games_, game_count_);",
    "      return;",
    "    }",
    "    games_[active_game_].update(frame);",
    "    games_[active_game_].render();",
    "  }",
    " private:",
    "  TouchEvent readTouch() {",
    "    // Boardadapter anbinden: Touchcontroller auslesen und kalibrierte Koordinaten liefern.",
    "    return {false, 0, 0};",
    "  }",
    "  GameDescriptor games_[8];",
    "  StartScreen start_screen_;",
    "  int game_count_;",
    "  int active_game_;",
    "  uint32_t frame_number_;",
    "};",
    "}",
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

function source(path, content) {
  return { path, role: "user_code", content_type: "text/x-c++src", content };
}

function header(path, content) {
  return { path, role: "user_code", content_type: "text/x-c++hdr", content };
}

module.exports = { selectedGamesHeader, templateFirmwareSources };
