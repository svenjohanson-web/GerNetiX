const HelpView = (() => {
  let selectedTopicId = "quick-start";
  let messages = [];
  let bound = false;

  function render() {
    const mount = document.querySelector("#helpMount");
    if (!mount) return;
    const requested = window.location.hash.replace(/^#/, "");
    if (requested && HelpContent.findTopic(requested)?.articleId) selectedTopicId = requested;
    if (!HelpContent.findTopic(selectedTopicId)?.articleId) selectedTopicId = "quick-start";
    const selected = HelpContent.findTopic(selectedTopicId);
    const article = HelpContent.articles[selected.articleId];
    mount.innerHTML = `
      <header class="section-head help-page-head">
        <div>
          <p class="eyebrow">GerNetiX</p>
          <h2>Help</h2>
          <p class="helper-text">Find answers, explore GerNetiX topics or ask the assistant.</p>
        </div>
      </header>
      <div class="help-layout">
        <nav class="panel help-topic-navigation" aria-label="Help topics">
          <p class="eyebrow">Topics</p>
          ${HelpContent.topics.map(renderTopic).join("")}
        </nav>
        <article class="panel help-article" aria-live="polite">
          ${renderArticle(article, selected)}
        </article>
      </div>
      <section class="panel help-chat" aria-labelledby="helpChatTitle">
        <header class="help-chat-head">
          <div><p class="eyebrow">Dedicated help assistant</p><h3 id="helpChatTitle">Ask GerNetiX Help</h3></div>
          <p>Ask about using GerNetiX or a basic technical topic. This is separate from your project and programming chats.</p>
        </header>
        <div class="help-chat-messages" aria-live="polite">
          ${messages.length ? messages.map(renderMessage).join("") : '<p class="helper-text">Try: “How do I pair my ESP32?” or “Which ESP32 should I use?”</p>'}
        </div>
        <form id="helpChatForm" class="help-chat-form">
          <label for="helpChatInput">Your question</label>
          <span class="help-chat-input-box"><textarea id="helpChatInput" rows="2" placeholder="Enter your question about GerNetiX..."></textarea><button class="primary" type="submit">Send</button></span>
        </form>
      </section>`;
    if (!bound) bind(mount);
  }

  function renderTopic(topic) {
    const hasSelectedChild = topic.children?.some((child) => child.id === selectedTopicId);
    return `<details class="help-topic-group" ${hasSelectedChild ? "open" : ""}>
      <summary><span><strong>${escapeHtml(topic.title)}</strong><small>${escapeHtml(topic.description || "")}</small></span></summary>
      <div>${(topic.children || []).map((child) => child.articleId
        ? `<button class="help-topic-link ${child.id === selectedTopicId ? "active" : ""}" type="button" data-help-topic="${escapeHtml(child.id)}" ${child.id === selectedTopicId ? 'aria-current="page"' : ""}>${escapeHtml(child.title)}</button>`
        : `<span class="help-topic-placeholder">${escapeHtml(child.title)}<small>Coming soon</small></span>`).join("")}</div>
    </details>`;
  }

  function renderArticle(article, topic) {
    return `<header class="help-article-head"><p class="eyebrow">${escapeHtml(parentTitle(topic.id))}</p><h2>${escapeHtml(article.title)}</h2><p>${escapeHtml(article.summary)}</p></header>
      ${article.sections.map((section) => `<section class="help-article-section">
        <h3>${escapeHtml(section.heading)}</h3>
        ${(section.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
        ${section.list ? `<ul>${section.list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
        ${section.table ? `<div class="help-article-table-wrap"><table class="help-article-table"><thead><tr>${section.table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${section.table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : ""}
        ${section.code ? `<pre><code>${escapeHtml(section.code)}</code></pre>` : ""}
        ${section.links ? `<p class="help-inline-links">${section.links.map((link) => `<button type="button" data-help-topic="${escapeHtml(link.topicId)}">${escapeHtml(link.label)}</button>`).join("")}</p>` : ""}
      </section>`).join("")}
      ${article.actions?.length ? `<div class="button-row help-next-actions">${article.actions.map((action) => `<button type="button" data-help-route="${escapeHtml(action.route)}">${escapeHtml(action.label)}</button>`).join("")}</div>` : ""}
      ${article.relatedTopics?.length ? `<section class="help-related"><h3>Related help topics</h3>${article.relatedTopics.map(renderRelatedTopic).join("")}</section>` : ""}`;
  }

  function renderMessage(message) {
    return `<article class="help-chat-message ${message.role}"><strong>${message.role === "user" ? "You" : "GerNetiX Help"}</strong><p>${escapeHtml(message.text)}</p>${message.relatedTopics?.length ? `<div class="help-chat-related"><span>Related help topics</span>${message.relatedTopics.map(renderRelatedTopic).join("")}</div>` : ""}</article>`;
  }

  function renderRelatedTopic(topicId) {
    const topic = HelpContent.findTopic(topicId);
    if (!topic) return "";
    return `<button type="button" data-help-topic="${escapeHtml(topic.id)}">${escapeHtml(topic.title)}</button>`;
  }

  function parentTitle(topicId) {
    return HelpContent.topics.find((topic) => topic.children?.some((child) => child.id === topicId))?.title || "Help";
  }

  function bind(mount) {
    bound = true;
    mount.addEventListener("click", (event) => {
      const topic = event.target.closest("[data-help-topic]");
      if (topic) {
        selectTopic(topic.dataset.helpTopic);
        return;
      }
      const route = event.target.closest("[data-help-route]");
      if (route) window.navigate(route.dataset.helpRoute);
    });
    mount.addEventListener("submit", async (event) => {
      if (event.target.id !== "helpChatForm") return;
      event.preventDefault();
      const input = mount.querySelector("#helpChatInput");
      const question = input.value.trim();
      if (!question) return;
      messages.push({ role: "user", text: question });
      input.value = "";
      render();
      try {
        const response = await HelpChatService.answer(question, messages.slice(0, -1).map((message) => ({ role: message.role, content: message.text })));
        messages.push({ role: "assistant", text: response.answer, relatedTopics: response.relatedTopics || [] });
        if (response.openTopicId) selectedTopicId = response.openTopicId;
      } catch (error) {
        messages.push({ role: "assistant", text: error.message || "The local help assistant is not available right now.", relatedTopics: [] });
      }
      render();
    });
  }

  function selectTopic(topicId) {
    const topic = HelpContent.findTopic(topicId);
    if (!topic?.articleId) return;
    selectedTopicId = topicId;
    history.replaceState({}, "", `/app/help/#${topicId}`);
    render();
  }

  function openDialog(topicId) {
    const topic = HelpContent.findTopic(topicId);
    const article = topic?.articleId ? HelpContent.articles[topic.articleId] : null;
    if (!article) return;
    let dialog = document.querySelector("#helpTopicDialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "helpTopicDialog";
      dialog.className = "help-topic-dialog";
      document.body.append(dialog);
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
    }
    dialog.innerHTML = `<div class="help-topic-dialog-shell">
      <button class="help-topic-dialog-close" type="button" aria-label="Hilfe schließen" title="Schließen">×</button>
      <article class="help-article">${renderArticle(article, topic)}</article>
    </div>`;
    dialog.querySelector(".help-topic-dialog-close").addEventListener("click", () => dialog.close());
    dialog.querySelectorAll("[data-help-topic]").forEach((button) => {
      button.addEventListener("click", () => openDialog(button.dataset.helpTopic));
    });
    dialog.querySelectorAll("[data-help-route]").forEach((button) => {
      button.addEventListener("click", () => {
        dialog.close();
        window.navigate(button.dataset.helpRoute);
      });
    });
    if (!dialog.open) dialog.showModal();
  }

  function escapeHtml(value) {
    return DomUtils.escapeHtml(value);
  }

  return { render, selectTopic, openDialog };
})();
