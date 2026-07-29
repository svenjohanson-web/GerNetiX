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

  function scoreAnswers(questions, answers) {
    return questions.reduce((score, question, index) =>
      score + (answers[index] === question.correctIndex ? 1 : 0), 0);
  }

  function create({ mount, getLocale }) {
    const state = {
      categoryId: "",
      questionIndex: 0,
      answers: [],
      resultVisible: false,
    };

    function catalog() {
      return window.GerNetiXQuizData.getCatalog(getLocale());
    }

    function selectedCategory(currentCatalog = catalog()) {
      return currentCatalog.categories.find((category) => category.id === state.categoryId);
    }

    function render() {
      const currentCatalog = catalog();
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
      const correct = answered && selectedAnswer === question.correctIndex;
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
                  answered && index === question.correctIndex ? "is-correct" : "",
                  answered && index === selectedAnswer && index !== question.correctIndex ? "is-incorrect" : "",
                ].filter(Boolean).join(" ");
                return `<button class="${classes}" type="button" data-quiz-answer="${index}"${answered ? " disabled" : ""}><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`;
              }).join("")}
            </div>
          </fieldset>
          ${answered ? `
            <aside class="quiz-feedback ${correct ? "is-correct" : "is-incorrect"}" aria-live="polite">
              <strong>${escapeHtml(correct ? text.correct : text.incorrect)}</strong>
              ${correct ? "" : `<p><b>${escapeHtml(text.answer)}</b> ${escapeHtml(question.options[question.correctIndex])}</p>`}
              <p>${escapeHtml(question.explanation)}</p>
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
      const score = scoreAnswers(category.questions, state.answers);
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
      state.resultVisible = false;
      render();
    }

    function answer(optionIndex) {
      if (Number.isInteger(state.answers[state.questionIndex])) return;
      state.answers[state.questionIndex] = optionIndex;
      render();
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
