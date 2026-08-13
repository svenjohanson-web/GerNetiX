"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createQuizContentStore({ sourcePath = path.join(__dirname, "quiz-data.js") } = {}) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const context = vm.createContext({ window: {} });
  vm.runInContext(source, context, { filename: sourcePath });
  const quizData = context.window.GerNetiXQuizData;

  function fullCatalog(locale) {
    return JSON.parse(JSON.stringify(quizData.getCatalog(locale)));
  }

  function catalogFor(locale) {
    const catalog = fullCatalog(locale);
    catalog.categories.forEach((category) => category.questions.forEach((question) => {
      delete question.correctIndex;
      delete question.explanation;
    }));
    return catalog;
  }

  function evaluate({ locale, categoryId, questionId, optionIndex }) {
    const catalog = fullCatalog(locale);
    const category = catalog.categories.find((entry) => entry.id === categoryId);
    const question = category?.questions.find((entry) => entry.id === questionId);
    if (!question || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) return null;
    return {
      question_id: question.id,
      correct: optionIndex === question.correctIndex,
      correct_index: question.correctIndex,
      correct_option: question.options[question.correctIndex],
      explanation: question.explanation,
    };
  }

  return { catalogFor, evaluate };
}

module.exports = { createQuizContentStore };
