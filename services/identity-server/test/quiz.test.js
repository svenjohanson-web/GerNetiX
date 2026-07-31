const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appRoot = path.join(__dirname, "..", "public", "app");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const app = readPlatformAppSource();
const css = fs.readFileSync(path.join(appRoot, "app.css"), "utf8");
const dataSource = fs.readFileSync(path.join(appRoot, "quiz-data.js"), "utf8");
const quizSource = fs.readFileSync(path.join(appRoot, "quiz.js"), "utf8");

function loadQuizModules() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(dataSource, context);
  vm.runInContext(quizSource, context);
  return context.window;
}

test("offers a dedicated internal quiz route from navigation and dashboard", () => {
  assert.match(html, /href="\/app\/quiz\/" data-route="quiz" data-i18n="platform\.nav\.quiz">Quiz<\/a>/);
  assert.match(html, /data-open-route="\/app\/quiz\/"[\s\S]*data-i18n="dashboard\.quiz\.title">Quiz/);
  assert.match(html, /id="quizView"[\s\S]*id="quizMount"/);
  assert.match(html, /quiz-data\.js[\s\S]*quiz\.js[\s\S]*app\.js/);
  assert.match(app, /quiz: "quizView"/);
  assert.match(app, /if \(route === "quiz"\) quiz\(\)\.render\(\)/);
  assert.match(css, /\.quiz-category-grid/);
  assert.match(css, /\.quiz-option\.is-correct/);
  assert.match(css, /\.quiz-result/);
});

test("keeps the four quiz categories structurally equal in German, English and Dutch", () => {
  const { GerNetiXQuizData } = loadQuizModules();
  const catalogs = ["de", "en", "nl"].map((locale) => GerNetiXQuizData.getCatalog(locale));
  const expectedIds = ["embedded", "electrical-engineering", "software", "distributed-systems"];
  for (const catalog of catalogs) {
    assert.deepEqual(Array.from(catalog.categories, (category) => category.id), expectedIds);
    for (const category of catalog.categories) {
      assert.equal(category.questions.length, 3);
      for (const question of category.questions) {
        assert.equal(question.options.length, 4);
        assert.ok(question.correctIndex >= 0 && question.correctIndex < question.options.length);
        assert.ok(question.explanation.length > 30);
      }
    }
  }
  assert.notEqual(catalogs[0].categories[1].title, catalogs[2].categories[1].title);
  assert.ok(new Set(catalogs[0].categories.flatMap((category) =>
    category.questions.map((question) => question.correctIndex))).size > 1);
});

test("scores quiz answers without persisting browser state", () => {
  const { GerNetiXQuizData, GerNetiXQuiz } = loadQuizModules();
  const questions = GerNetiXQuizData.getCatalog("de").categories[0].questions;
  assert.equal(GerNetiXQuiz.scoreAnswers(questions, questions.map((question) => question.correctIndex)), 3);
  assert.equal(GerNetiXQuiz.scoreAnswers(questions, questions.map((question) => (question.correctIndex + 1) % 4)), 0);
  assert.doesNotMatch(`${dataSource}\n${quizSource}`, /(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]|fetch\(/);
});
