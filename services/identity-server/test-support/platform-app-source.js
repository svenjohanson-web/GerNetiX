"use strict";

const fs = require("node:fs");
const path = require("node:path");

const platformAppFiles = [
  "app-shell-early.js",
  // Der gemeinsame Zustand liegt seit der Entflechtung in einer eigenen
  // Datei und wird vor den Controllern geladen. Die Reihenfolge hier muss
  // der in index.html entsprechen, sie wird gegen sie geprueft.
  "platform-state.js",
  "platform-routing.js",
  "app-shell-controller.js",
  "app-dashboard-controller.js",
  "app-community-controller.js",
  "app-account-controller.js",
  "app-project-controller.js",
  "app-ide-controller.js",
  "app-device-build-controller.js",
  "app-billing-controller.js",
  "app-runtime-utils.js",
  "app-push-controller.js",
  "app.js",
  "device-debug-controller.js",
  "app-event-bindings.js",
];
const routeLazyPlatformAppFiles = new Set([
  "app-community-controller.js",
  "app-ide-controller.js",
  "app-device-build-controller.js",
  "device-debug-controller.js",
]);

function readPlatformAppSource() {
  const appRoot = path.resolve(__dirname, "../public/app");
  return platformAppFiles
    .map((file) => fs.readFileSync(path.join(appRoot, file), "utf8"))
    .join("\n");
}

module.exports = { platformAppFiles, readPlatformAppSource, routeLazyPlatformAppFiles };
