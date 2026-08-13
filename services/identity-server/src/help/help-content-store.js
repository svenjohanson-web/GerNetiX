"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createHelpContentStore({ sourcePath = path.join(__dirname, "help-content.js") } = {}) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const context = vm.createContext({});
  vm.runInContext(`${source}\n;globalThis.__helpContent = HelpContent;`, context, { filename: sourcePath });
  const content = JSON.parse(JSON.stringify(context.__helpContent));

  return {
    responseForSession() {
      return { access: "account", topics: content.topics, articles: content.articles };
    },
  };
}

module.exports = { createHelpContentStore };
