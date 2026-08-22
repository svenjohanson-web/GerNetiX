"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourcePath = path.join(__dirname, "..", "public", "navigation-model.js");
const source = fs.readFileSync(sourcePath, "utf8");
const context = { window: {} };
vm.runInNewContext(source, context, { filename: sourcePath });

const navigationModel = context.window.GerNetiXNavigationModel;

function authenticatedItems() {
  return [
    ...navigationModel.authenticated.primary,
    ...navigationModel.authenticated.groups.flatMap((group) => group.items),
    ...navigationModel.authenticated.fixed,
  ];
}

function authenticatedItem(hrefOrId) {
  return authenticatedItems().find((item) => item.href === hrefOrId || item.id === hrefOrId);
}

function authenticatedGroup(i18n) {
  return navigationModel.authenticated.groups.find((group) => group.i18n === i18n);
}

module.exports = { authenticatedGroup, authenticatedItem, authenticatedItems, navigationModel, source };
