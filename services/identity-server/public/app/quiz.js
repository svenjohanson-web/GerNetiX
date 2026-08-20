import { GerNetiXQuizData } from "@app/quiz-data.js";

(() => {
  function interpolate(message, variables) {
    return String(message).replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) =>
      Object.hasOwn(variables, key) ? String(variables[key]) : `{${key}}`);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function scoreAnswers(_questions, results) {
    return results.reduce((score, result) => score + (result?.correct ? 1 : 0), 0);
  }

  function create({ mount, getLocale }) {
    const state = {
      categoryId: "",
      questionIndex: 0,
      answers: [],
      results: [],
      resultVisible: false,
      catalog: null,
      locale: "",
      loading: false,
      error: "",
    };

    async function catalog() {
      const locale = getLocale();
      if (state.catalog && state.locale === locale) return state.catalog;
      state.locale = locale;
      state.catalog = await window.GerNetiXQuizData.getCatalog(locale);
      return state.catalog;
    }

    function selectedCategory(currentCatalog = state.catalog) {
      return currentCatalog.categories.find((category) => category.id === state.categoryId);
    }

    async function render() {
      if (state.loading) return;
      state.loading = true;
      state.error = "";
      mount.innerHTML = '<section class="panel quiz-round" aria-busy="true"><p>Quiz wird geladen …</p></section>';
      let currentCatalog;
      try {
        currentCatalog = await catalog();
      } catch (error) {
        state.error = error.message || "Quiz konnte nicht geladen werden.";
        mount.innerHTML = `<section class="panel quiz-round" role="alert"><p>${escapeHtml(state.error)}</p></section>`;
        return;
      } finally {
        state.loading = false;
      }
      if (!state.categoryId) {
        renderCategories(currentCatalog);
        return;
      }
      const category = selectedCategory(currentCatalog);
      if (!category) {
        reset();
        return;
      }
      if (state.resultVisible) {
        renderResult(currentCatalog, category);
        return;
      }
      renderQuestion(currentCatalog, category);
    }

    function renderCategories(currentCatalog) {
      const { labels: text } = currentCatalog;
      mount.innerHTML = `
        <header class="quiz-hero">
          <p class="eyebrow">${escapeHtml(text.eyebrow)}</p>
          <h2>${escapeHtml(text.title)}</h2>
          <p>${escapeHtml(text.intro)}</p>
        </header>
        <section class="quiz-category-grid" aria-label="${escapeHtml(text.title)}">
          ${currentCatalog.categories.map((category) => `
            <article class="panel quiz-category-card">
              <span class="quiz-category-icon" aria-hidden="true">${escapeHtml(category.icon)}</span>
              <div>
                <h3>${escapeHtml(category.title)}</h3>
                <p>${escapeHtml(category.description)}</p>
              </div>
              <small>${escapeHtml(text.questions)}</small>
              <button class="primary" type="button" data-start-quiz="${escapeHtml(category.id)}">${escapeHtml(text.start)}</button>
            </article>
          `).join("")}
        </section>
        <p class="quiz-session-notice">${escapeHtml(text.sessionNotice)}</p>
      `;
      mount.querySelectorAll("[data-start-quiz]").forEach((button) => {
        button.addEventListener("click", () => start(button.dataset.startQuiz));
      });
    }

    function renderQuestion(currentCatalog, category) {
      const { labels: text } = currentCatalog;
      const question = category.questions[state.questionIndex];
      const selectedAnswer = state.answers[state.questionIndex];
      const answered = Number.isInteger(selectedAnswer);
      const result = state.results[state.questionIndex];
      const correct = Boolean(result?.correct);
      mount.innerHTML = `
        <section class="panel quiz-round">
          <header class="quiz-round-head">
            <button class="quiz-back" type="button" data-quiz-categories>← ${escapeHtml(text.back)}</button>
            <div>
              <span class="quiz-category-label">${escapeHtml(category.icon)} ${escapeHtml(category.title)}</span>
              <strong>${escapeHtml(interpolate(text.question, { current: state.questionIndex + 1, total: category.questions.length }))}</strong>
            </div>
          </header>
          <div class="quiz-progress" aria-hidden="true"><span style="width: ${((state.questionIndex + 1) / category.questions.length) * 100}%"></span></div>
          <fieldset class="quiz-question">
            <legend>${escapeHtml(question.prompt)}</legend>
            <p>${escapeHtml(text.select)}</p>
            <div class="quiz-options">
              ${question.options.map((option, index) => {
                const classes = [
                  "quiz-option",
                  answered && index === result?.correct_index ? "is-correct" : "",
                  answered && index === selectedAnswer && !result?.correct ? "is-incorrect" : "",
                ].filter(Boolean).join(" ");
                return `<button class="${classes}" type="button" data-quiz-answer="${index}"${answered ? " disabled" : ""}><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`;
              }).join("")}
            </div>
          </fieldset>
          ${answered ? `
            <aside class="quiz-feedback ${correct ? "is-correct" : "is-incorrect"}" aria-live="polite">
              <strong>${escapeHtml(correct ? text.correct : text.incorrect)}</strong>
              ${correct ? "" : `<p><b>${escapeHtml(text.answer)}</b> ${escapeHtml(result?.correct_option || "")}</p>`}
              <p>${escapeHtml(result?.explanation || "")}</p>
            </aside>
            <div class="quiz-next-row">
              <button class="primary" type="button" data-quiz-next>${escapeHtml(state.questionIndex === category.questions.length - 1 ? text.finish : text.next)}</button>
            </div>
          ` : ""}
        </section>
      `;
      mount.querySelector("[data-quiz-categories]")?.addEventListener("click", reset);
      mount.querySelectorAll("[data-quiz-answer]").forEach((button) => {
        button.addEventListener("click", () => answer(Number(button.dataset.quizAnswer)));
      });
      mount.querySelector("[data-quiz-next]")?.addEventListener("click", next);
    }

    function renderResult(currentCatalog, category) {
      const { labels: text } = currentCatalog;
      const score = scoreAnswers(category.questions, state.results);
      const ratio = score / category.questions.length;
      const resultText = ratio === 1 ? text.resultStrong : (ratio >= 0.5 ? text.resultMedium : text.resultStart);
      mount.innerHTML = `
        <section class="panel quiz-result">
          <span class="quiz-result-icon" aria-hidden="true">${ratio === 1 ? "✓" : `${score}/${category.questions.length}`}</span>
          <p class="eyebrow">${escapeHtml(text.resultEyebrow)}</p>
          <h2>${escapeHtml(interpolate(text.result, { score, total: category.questions.length }))}</h2>
          <p>${escapeHtml(resultText)}</p>
          <div class="button-row">
            <button class="primary" type="button" data-quiz-retry>${escapeHtml(text.retry)}</button>
            <button type="button" data-quiz-categories>${escapeHtml(text.categories)}</button>
          </div>
        </section>
      `;
      mount.querySelector("[data-quiz-retry]")?.addEventListener("click", () => start(category.id));
      mount.querySelector("[data-quiz-categories]")?.addEventListener("click", reset);
    }

    function start(categoryId) {
      state.categoryId = categoryId;
      state.questionIndex = 0;
      state.answers = [];
      state.results = [];
      state.resultVisible = false;
      render();
    }

    async function answer(optionIndex) {
      if (Number.isInteger(state.answers[state.questionIndex])) return;
      state.answers[state.questionIndex] = optionIndex;
      const category = selectedCategory();
      const question = category?.questions[state.questionIndex];
      try {
        state.results[state.questionIndex] = await window.GerNetiXQuizData.evaluate(
          state.locale,
          category.id,
          question.id,
          optionIndex,
        );
      } catch (error) {
        state.answers[state.questionIndex] = undefined;
        state.error = error.message || "Antwort konnte nicht geprüft werden.";
      }
      void render();
    }

    function next() {
      const category = selectedCategory();
      if (!category || !Number.isInteger(state.answers[state.questionIndex])) return;
      if (state.questionIndex >= category.questions.length - 1) state.resultVisible = true;
      else state.questionIndex += 1;
      render();
    }

    function reset() {
      state.categoryId = "";
      state.questionIndex = 0;
      state.answers = [];
      state.results = [];
      state.resultVisible = false;
      render();
    }

    return { render, reset, start };
  }

  window.GerNetiXQuiz = {
    create,
    scoreAnswers,
  };
})();

/*
 * Diese Datei veroeffentlicht ihre Schnittstelle nach UMD-Art durch Zuweisung
 * an das globale Objekt. Es gibt keine gleichnamige Bindung, also wird sie hier
 * angelegt: derselbe Wert, nur ansprechbar fuer den export.
 */
const GerNetiXQuiz = globalThis.GerNetiXQuiz;

export {
  GerNetiXQuiz,
};
