const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { createQuizContentStore } = require("../src/quiz/quiz-content-store");

const appRoot = path.join(__dirname, "..", "public", "app");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const app = readPlatformAppSource();
const css = fs.readFileSync(path.join(appRoot, "app.css"), "utf8");
const dataSource = fs.readFileSync(path.join(appRoot, "quiz-data.js"), "utf8");
const quizSource = fs.readFileSync(path.join(appRoot, "quiz.js"), "utf8");
const serverDataSource = fs.readFileSync(path.join(__dirname, "..", "src", "quiz", "quiz-data.js"), "utf8");

function loadQuizModule() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(quizSource, context);
  return context.window;
}

test("offers a dedicated internal quiz route from navigation and dashboard", () => {
  assert.match(html, /href="\/app\/quiz\/" data-route="quiz" data-i18n="platform\.nav\.quiz">Quiz<\/a>/);
  assert.match(html, /data-open-route="\/app\/quiz\/"[\s\S]*data-i18n="dashboard\.quiz\.title">Quiz/);
  assert.match(html, /id="quizView"[\s\S]*id="quizMount"/);
  assert.doesNotMatch(html, /<script[^>]+quiz-data\.js/);
  assert.doesNotMatch(html, /<script[^>]+\/quiz\.js/);
  assert.match(app, /async function loadQuizAssets\(\)/);
  assert.match(app, /loadPlatformScript\("\/app\/quiz-data\.js/);
  assert.match(app, /loadPlatformScript\("\/app\/quiz\.js/);
  assert.match(app, /quiz: "quizView"/);
  assert.match(app, /if \(route === "quiz"\) void loadQuizAssets\(\)\.then\(\(\) => quiz\(\)\.render\(\)\)/);
  assert.match(css, /\.quiz-category-grid/);
  assert.match(css, /\.quiz-option\.is-correct/);
  assert.match(css, /\.quiz-result/);
});

test("keeps the four quiz categories structurally equal in German, English and Dutch", () => {
  const store = createQuizContentStore();
  const catalogs = ["de", "en", "nl"].map((locale) => store.catalogFor(locale));
  const expectedIds = ["embedded", "electrical-engineering", "software", "distributed-systems"];
  for (const catalog of catalogs) {
    assert.deepEqual(Array.from(catalog.categories, (category) => category.id), expectedIds);
    for (const category of catalog.categories) {
      assert.equal(category.questions.length, 3);
      for (const question of category.questions) {
        assert.equal(question.options.length, 4);
        assert.equal(question.correctIndex, undefined);
        assert.equal(question.explanation, undefined);
      }
    }
  }
  assert.notEqual(catalogs[0].categories[1].title, catalogs[2].categories[1].title);
  assert.doesNotMatch(dataSource, /correctIndex|explanation:/);
  assert.match(serverDataSource, /correctIndex/);
});

test("evaluates quiz answers on the server without persisting browser state", () => {
  const store = createQuizContentStore();
  const catalog = store.catalogFor("de");
  const question = catalog.categories[0].questions[0];
  const evaluations = question.options.map((_option, optionIndex) => store.evaluate({
    locale: "de", categoryId: "embedded", questionId: question.id, optionIndex,
  }));
  assert.equal(evaluations.filter((result) => result.correct).length, 1);
  assert.ok(evaluations.every((result) => result.explanation.length > 30));
  const { GerNetiXQuiz } = loadQuizModule();
  assert.equal(GerNetiXQuiz.scoreAnswers([], [{ correct: true }, { correct: false }]), 1);
  assert.doesNotMatch(`${dataSource}\n${quizSource}`, /(?:window\.)?(?:localStorage|sessionStorage)\s*[.[]/);
});
