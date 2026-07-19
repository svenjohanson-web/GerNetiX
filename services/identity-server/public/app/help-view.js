const HelpView = (() => {
  let selectedTopicId = "quick-start";
  let messages = [];
  let bound = false;
  let access = { hasAccount: true, premium: false };
  let surface = "help";
  let knowledgeScrollHandler = null;

  function render(nextAccess = access) {
    access = { ...access, ...nextAccess };
    surface = nextAccess.surface || surface;
    const mount = document.querySelector("#helpMount");
    if (!mount) return;
    const visibleTopics = HelpContent.topics.filter((topic) => (topic.surface || "help") === surface);
    const requested = window.location.hash.replace(/^#/, "");
    if (requested && visibleTopics.some((topic) => topic.children?.some((child) => child.id === requested))) selectedTopicId = requested;
    if (!visibleTopics.some((topic) => topic.children?.some((child) => child.id === selectedTopicId))) selectedTopicId = visibleTopics[0]?.children?.[0]?.id || "quick-start";
    const selected = HelpContent.findTopic(selectedTopicId);
    const article = HelpContent.articles[selected.articleId];
    const portal = surface === "knowledge";
    mount.innerHTML = `
      <header class="section-head help-page-head">
        <div>
          <p class="eyebrow">GerNetiX</p>
          <h2>${portal ? "Wissensportal" : "Hilfe"}</h2>
          <p class="helper-text">${portal ? "Grundlagen und Zusammenhänge, die über einzelne GerNetiX-Projekte hinausgehen." : "Konkrete Abläufe, Konto- und Projektfunktionen in GerNetiX."}</p>
        </div>
      </header>
      ${portal ? renderKnowledgeBook(visibleTopics) : `<div class="help-layout">
        <nav class="panel help-topic-navigation" aria-label="${portal ? "Wissensportal-Themen" : "Hilfethemen"}">
          <p class="eyebrow">${portal ? "Themenbereiche" : "Hilfethemen"}</p>
          ${visibleTopics.map(renderTopic).join("")}
        </nav>
        <article class="panel help-article" aria-live="polite">
          ${renderArticle(article, selected)}
        </article>
      </div>`}
      ${portal ? "" : `<section class="panel help-chat" aria-labelledby="helpChatTitle">
        <header class="help-chat-head">
          <div><p class="eyebrow">Dedicated help assistant</p><h3 id="helpChatTitle">Ask GerNetiX Help</h3></div>
          <p>Ask about using GerNetiX or a basic technical topic. This is separate from your project and programming chats.</p>
        </header>
        <div class="help-chat-messages" aria-live="polite">
          ${messages.length ? messages.map(renderMessage).join("") : '<p class="helper-text">Try: “How do I pair my ESP32?” or “Which ESP32 should I use?”</p>'}
        </div>
        <form id="helpChatForm" class="help-chat-form">
          <label for="helpChatInput">Your question</label>
          <span class="help-chat-input-box"><textarea id="helpChatInput" rows="2" placeholder="${access.premium ? "Enter your question about GerNetiX..." : "KI-Unterstuetzung ist mit Premium verfuegbar."}" ${access.premium ? "" : "disabled"}></textarea><button class="primary" type="submit" ${access.premium ? "" : "disabled"}>Send</button></span>
          ${access.premium ? "" : '<p class="chat-premium-hint">KI-Unterstuetzung ist im Premium-Abo enthalten. <a href="/hilfe/#ai-premium">Warum?</a></p>'}
        </form>
      </section>`}`;
    if (article.hardwareCatalog) loadHardwareCatalog(mount);
    if (portal) activateKnowledgeBook(mount, selectedTopicId);
    if (!bound) bind(mount);
  }

  function renderKnowledgeBook(topics) {
    return `<div class="knowledge-book-layout">
      <nav class="panel knowledge-book-navigation" aria-label="Kapitelübersicht">
        <p class="eyebrow">Inhalt</p>
        ${topics.map((topic, index) => `<section><button class="knowledge-part-link" type="button" data-knowledge-part="${escapeHtml(topic.id)}"><span>${index + 1}</span>${escapeHtml(topic.title)}</button>${(topic.children || []).map((child, childIndex) => {
          const chapterNumber = `${index + 1}.${childIndex + 1}`;
          return `<a href="#${escapeHtml(child.id)}" data-knowledge-topic="${escapeHtml(child.id)}"><span>${chapterNumber}</span>${escapeHtml(child.title)}</a>${(child.subchapters || []).map((subchapter, subchapterIndex) => `<a class="knowledge-subchapter-link" href="#${escapeHtml(subchapter.id)}" data-knowledge-subchapter="${escapeHtml(subchapter.id)}"><span>${chapterNumber}.${subchapterIndex + 1}</span>${escapeHtml(subchapter.title)}</a>`).join("")}`;
        }).join("")}</section>`).join("")}
      </nav>
      <main class="knowledge-book-content" aria-label="Wissensportal-Lektüre">
        ${topics.map((topic, index) => `<section id="knowledge-part-${escapeHtml(topic.id)}" class="knowledge-book-part" data-knowledge-part="${escapeHtml(topic.id)}"><header><p class="eyebrow">Hauptkapitel ${index + 1}</p><h2>${index + 1}. ${escapeHtml(topic.title)}</h2>${topic.description ? `<p>${escapeHtml(topic.description)}</p>` : ""}${topic.serverLandscape ? renderServerTypesVisual() : ""}</header>${(topic.children || []).map((child, childIndex) => {
          const chapter = HelpContent.articles[child.articleId];
          const chapterNumber = `${index + 1}.${childIndex + 1}`;
          return `<article id="${escapeHtml(child.id)}" class="panel help-article knowledge-book-chapter" data-knowledge-chapter="${escapeHtml(child.id)}"><p class="knowledge-chapter-number">${chapterNumber}</p>${renderArticle(chapter, child, { showRelated: false, chapterNumber })}</article>`;
        }).join("")}</section>`).join("")}
      </main>
    </div>`;
  }

  function activateKnowledgeBook(mount, topicId) {
    if (knowledgeScrollHandler) window.removeEventListener("scroll", knowledgeScrollHandler);
    const updateActiveChapter = (nextTopicId) => {
      selectedTopicId = nextTopicId;
      mount.querySelectorAll("[data-knowledge-topic]").forEach((link) => {
        const active = link.dataset.knowledgeTopic === nextTopicId;
        link.classList.toggle("active", active);
        link.toggleAttribute("aria-current", active);
      });
    };
    const chapters = [...mount.querySelectorAll("[data-knowledge-chapter]")];
    let activeTopicId = "";
    const syncChapterWithScroll = () => {
      const readingLine = 132;
      const current = chapters.reduce((latest, chapter) => chapter.getBoundingClientRect().top <= readingLine ? chapter : latest, chapters[0]);
      const nextTopicId = current?.dataset.knowledgeChapter;
      if (!nextTopicId || nextTopicId === activeTopicId) return;
      activeTopicId = nextTopicId;
      updateActiveChapter(nextTopicId);
      history.replaceState({}, "", `/wissen/#${nextTopicId}`);
    };
    let animationFrame = 0;
    knowledgeScrollHandler = () => {
      if (animationFrame) return;
      animationFrame = requestAnimationFrame(() => {
        animationFrame = 0;
        syncChapterWithScroll();
      });
    };
    window.addEventListener("scroll", knowledgeScrollHandler, { passive: true });
    const requested = mount.querySelector(`[data-knowledge-chapter="${topicId}"]`);
    requestAnimationFrame(() => {
      if (requested && window.location.hash) requested.scrollIntoView({ block: "start" });
      syncChapterWithScroll();
    });
  }

  function renderTopic(topic) {
    const hasSelectedChild = topic.children?.some((child) => child.id === selectedTopicId);
    return `<details class="help-topic-group" ${hasSelectedChild ? "open" : ""}>
      <summary><span><strong>${escapeHtml(topic.title)}</strong><small>${escapeHtml(topic.description || "")}</small></span>${accessBadge(topic.access)}</summary>
      <div>${(topic.children || []).map((child) => child.articleId
        ? `<button class="help-topic-link ${child.id === selectedTopicId ? "active" : ""}" type="button" data-help-topic="${escapeHtml(child.id)}" ${child.id === selectedTopicId ? 'aria-current="page"' : ""}>${escapeHtml(child.title)}${accessBadge(HelpContent.articles[child.articleId]?.access)}</button>`
        : `<span class="help-topic-placeholder">${escapeHtml(child.title)}<small>Coming soon</small></span>`).join("")}</div>
    </details>`;
  }

  function renderArticle(article, topic, { showRelated = true, chapterNumber = "" } = {}) {
    if (!canAccess(article.access)) {
      const preview = article.access === "premium" ? article.sections.slice(0, 1) : [];
      return `<header class="help-article-head"><p class="eyebrow">${escapeHtml(parentTitle(topic.id))}</p><h2>${escapeHtml(article.title)}</h2><p>${escapeHtml(article.summary)}</p></header>
        ${preview.map((section) => `<section class="help-article-section"><h3>${escapeHtml(section.heading)}</h3>${(section.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}${section.list ? `<ul>${section.list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}</section>`).join("")}
        ${renderPaywall(article.access)}`;
    }
    return `<header class="help-article-head"><p class="eyebrow">${escapeHtml(parentTitle(topic.id))}</p><h2>${escapeHtml(article.title)}</h2><p>${escapeHtml(article.summary)}</p></header>
      ${article.sections.map((section, sectionIndex) => `<section${section.id ? ` id="${escapeHtml(section.id)}"` : ""} class="help-article-section">
        ${chapterNumber && section.id ? `<p class="knowledge-subchapter-number">${chapterNumber}.${sectionIndex + 1}</p>` : ""}
        <h3>${escapeHtml(section.heading)}</h3>
        ${(section.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
        ${section.systemLandscape ? renderSystemLandscapeVisual() : ""}
        ${section.serverLandscape ? renderServerTypesVisual() : ""}
        ${section.hardwareVisual ? renderHardwareVisual() : ""}
        ${section.list ? `<ul>${section.list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
        ${section.stateChart ? renderStateChart(section.stateChart) : ""}
        ${section.umlStateChart ? renderTamagotchiUmlStateChart() : ""}
        ${section.table ? `<div class="help-article-table-wrap"><table class="help-article-table"><thead><tr>${section.table.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${section.table.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : ""}
        ${section.code ? `<pre><code>${escapeHtml(section.code)}</code></pre>` : ""}
        ${section.links ? `<p class="help-inline-links">${section.links.map((link) => `<button type="button" data-help-topic="${escapeHtml(link.topicId)}">${escapeHtml(link.label)}</button>`).join("")}</p>` : ""}
        ${chapterNumber && section.id ? renderPracticeLessonLink(section.id, section.heading) : ""}
      </section>`).join("")}
      ${article.hardwareCatalog ? '<section id="compatibleHardwareCatalog" class="help-hardware-catalog"><p class="helper-text">Hardware Catalog wird geladen …</p></section>' : ""}
      ${article.actions?.length ? `<div class="button-row help-next-actions">${article.actions.map((action) => `<button type="button" data-help-route="${escapeHtml(action.route)}">${escapeHtml(action.label)}</button>`).join("")}</div>` : ""}
      ${chapterNumber ? renderPracticeLessonLink(topic.id, article.title, "chapter") : ""}
      ${showRelated && article.relatedTopics?.length ? `<section class="help-related"><h3>Weiterführende Artikel</h3>${article.relatedTopics.map(renderRelatedTopic).join("")}</section>` : ""}`;
  }

  function renderPracticeLessonLink(knowledgeTopicId, title, kind = "section") {
    const route = `/app/learn/?knowledge-topic=${encodeURIComponent(knowledgeTopicId)}`;
    const label = kind === "chapter" ? "Praktisches Beispiel im Lernbereich" : "Praxis-Lesson öffnen";
    const className = `help-practice-lesson ${kind === "chapter" ? "chapter" : ""}`;
    if (!access.hasAccount) return `<div class="${className} is-disabled" aria-disabled="true"><span>${label}</span><small>Anmeldung erforderlich · Demo-Link</small><b aria-hidden="true">→</b></div>`;
    return `<a class="${className}" href="${route}" data-practice-lesson="${escapeHtml(knowledgeTopicId)}" aria-label="${escapeHtml(`${label}: ${title}`)}"><span>${label}</span><small>Demo-Link · Zuordnung zu einer Lesson folgt</small><b aria-hidden="true">→</b></a>`;
  }

  function renderStateChart(chart) {
    return `<div class="help-state-chart" aria-label="${escapeHtml(chart.title || "Zustandsdiagramm")}">
      <p class="eyebrow">${escapeHtml(chart.title || "Zustandsdiagramm")}</p>
      <div class="help-state-chart-nodes">${(chart.states || []).map((state) => `<span class="help-state-node ${state.initial ? "initial" : ""}">${escapeHtml(state.title)}</span>`).join("")}</div>
      <ul class="help-state-chart-transitions">${(chart.transitions || []).map((transition) => `<li><strong>${escapeHtml(transition.from)}</strong><span>→</span><strong>${escapeHtml(transition.to)}</strong><small>${escapeHtml(transition.when)}</small></li>`).join("")}</ul>
    </div>`;
  }

  function renderSystemLandscapeVisual() {
    return `<figure class="help-hardware-landscape knowledge-system-landscape" aria-label="Übersicht einer modernen Systemlandschaft"><div>
      <span>IoT-Geräte<small>Embedded-Systeme, Sensoren und Aktoren</small></span>
      <b aria-hidden="true">↔</b>
      <span>Server<small>Lokal · Internet/VPS · Cloud</small></span>
      <b aria-hidden="true">↔</b>
      <span>Apps<small>Mobil · PC/Mac · Web</small></span>
      </div>
    </figure>`;
  }

  function renderServerTypesVisual() {
    return `<figure class="help-hardware-landscape server-types-landscape" aria-label="Server als Oberbegriff für verschiedene Technologien">
      <div class="server-types-root"><span>Server</span></div>
      <div class="server-types-list">
        <span>Lokaler Server oder Gateway<small>vor Ort, nah an den Geräten</small></span>
        <span>Internet-Server oder VPS<small>öffentlich erreichbar, eigene Dienste</small></span>
        <span>Cloud-Dienste<small>verwaltet, flexibel skalierbar</small></span>
      </div>
    </figure>`;
  }

  function renderHardwareVisual() {
    return `<figure class="help-hardware-landscape" aria-label="Hardware-Landkarte von Mikrocontroller bis Edge AI"><div><span>Akku-I/O</span><b>→</b><span>ESP32</span><b>→</b><span>Embedded Linux</span><b>→</b><span>Industrie</span><b>→</b><span>Edge AI</span></div><figcaption>Je weiter rechts, desto mehr System- und Energieaufwand. Die beste Wahl ist die kleinste Ebene, die die Aufgabe zuverlässig erfüllt.</figcaption></figure>`;
  }

  function renderTamagotchiUmlStateChart() {
    return `<figure class="help-uml-state-chart">
      <svg viewBox="0 0 760 300" role="img" aria-labelledby="tamagotchiStateChartTitle tamagotchiStateChartDescription">
        <title id="tamagotchiStateChartTitle">UML-Statechart eines Tamagotchis</title>
        <desc id="tamagotchiStateChartDescription">Der Start führt zu satt. Ein timer_tick mit Hunger mindestens 50 führt zu hungrig, bei mindestens 80 zu warnung. fuettern führt aus hungrig oder warnung zurück zu satt.</desc>
        <defs><marker id="state-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z"></path></marker></defs>
        <circle cx="42" cy="74" r="9" class="uml-initial"></circle>
        <path d="M52 74 H100" class="uml-transition" marker-end="url(#state-arrow)"></path>
        <rect x="102" y="48" width="132" height="52" rx="10" class="uml-state"></rect><text x="168" y="80" text-anchor="middle">satt</text>
        <rect x="314" y="48" width="132" height="52" rx="10" class="uml-state"></rect><text x="380" y="80" text-anchor="middle">hungrig</text>
        <rect x="526" y="48" width="132" height="52" rx="10" class="uml-state warning"></rect><text x="592" y="80" text-anchor="middle">warnung</text>
        <path d="M234 74 H312" class="uml-transition" marker-end="url(#state-arrow)"></path><text x="273" y="35" text-anchor="middle">timer_tick [hunger ≥ 50]</text>
        <path d="M446 74 H524" class="uml-transition" marker-end="url(#state-arrow)"></path><text x="485" y="35" text-anchor="middle">timer_tick [hunger ≥ 80]</text>
        <path d="M380 101 V170 H168 V102" class="uml-transition" marker-end="url(#state-arrow)"></path><text x="274" y="160" text-anchor="middle">fuettern</text>
        <path d="M592 101 V238 H168 V102" class="uml-transition" marker-end="url(#state-arrow)"></path><text x="380" y="228" text-anchor="middle">fuettern</text>
      </svg>
      <figcaption>UML-Statechart: Ein Pfeil beschreibt einen möglichen Zustandswechsel. Der Text am Pfeil nennt Ereignis und – in eckigen Klammern – die zusätzliche Bedingung.</figcaption>
    </figure>`;
  }

  function canAccess(level = "public") {
    return level === "public" || (level === "account" && access.hasAccount) || (level === "premium" && access.premium);
  }

  function accessBadge(level = "public") {
    const labels = { public: "Öffentlich", account: "Konto", premium: "Premium" };
    return `<small class="help-access-badge ${level}">${labels[level] || labels.public}</small>`;
  }

  function renderPaywall(level) {
    const premium = level === "premium";
    return `<section class="help-paywall"><p class="eyebrow">${premium ? "Premium-Inhalt" : "Konto erforderlich"}</p><h3>${premium ? "Hier geht es mit Premium weiter" : "Melde dich an, um weiterzulesen"}</h3><p>${premium ? "Die Einführung bleibt sichtbar. Die konkrete Schrittfolge und vertiefenden Hinweise sind Bestandteil des Premium-Abos." : "Dieser Ablauf bezieht sich auf dein persönliches Board, Inventar oder Projekt und ist deshalb erst nach der Anmeldung verfügbar."}</p><button class="primary" type="button" data-help-route="${premium ? "/app/billing/" : "/app/auth/"}">${premium ? "Premium ansehen" : "Anmelden"}</button></section>`;
  }

  async function loadHardwareCatalog(mount) {
    const target = mount.querySelector("#compatibleHardwareCatalog");
    if (!target) return;
    try {
      const response = await ApiClient.getJson("/api/platform/hardware/processor-boards");
      const items = (response.items || []).filter((item) => item.status === "active");
      target.innerHTML = items.map(renderHardwareCard).join("") || '<p class="helper-text">Der Hardware Catalog enthält noch keine aktiven Boards.</p>';
    } catch (error) {
      target.innerHTML = `<p class="helper-text">Hardware Catalog ist gerade nicht erreichbar: ${escapeHtml(error.message || "Unbekannter Fehler")}</p>`;
    }
  }

  function renderHardwareCard(item) {
    const capabilities = (item.capability_ids || []).map((id) => id.replace(/^capability\./, "").replaceAll("_", " ")).slice(0, 7);
    const links = [
      item.documentation_url || item.peripheral_profile?.documentation_url ? `<a href="${escapeHtml(item.documentation_url || item.peripheral_profile.documentation_url)}" target="_blank" rel="noopener noreferrer">Datenblatt / Hersteller</a>` : "",
      item.purchase_url ? `<a href="${escapeHtml(item.purchase_url)}" target="_blank" rel="noopener noreferrer">Kaufoption</a>` : "",
    ].filter(Boolean).join("");
    const visual = item.image_url
      ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title)}" loading="lazy" />`
      : `<span aria-hidden="true">${escapeHtml(item.mcu_variant || "Board")}</span>`;
    return `<section class="help-hardware-card">
      <div class="help-hardware-visual">${visual}</div>
      <div><p class="eyebrow">${escapeHtml(item.vendor || "Hersteller unbekannt")} · ${escapeHtml(item.verification_status || "catalog")}</p><h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary || "Keine Kurzbeschreibung hinterlegt.")}</p>
      <p><strong>Prozessor:</strong> ${escapeHtml(item.mcu_variant || "nicht angegeben")} · <strong>Form:</strong> ${escapeHtml(item.form_factor || "nicht angegeben")}</p>
      <div class="help-hardware-capabilities">${capabilities.map((capability) => `<span>${escapeHtml(capability)}</span>`).join("")}</div>
      <p class="helper-text">Provisionierung: ${escapeHtml(item.provisioning_profile_id ? "USB-Flash mit GerNetiX-Profil vorgesehen" : "kein GerNetiX-Provisionierungsprofil hinterlegt")}</p>
      ${links ? `<p class="help-hardware-links">${links}</p>` : '<p class="helper-text">Herstellerbild und Beschaffungslink werden für diesen Katalogeintrag noch geprüft.</p>'}</div>
    </section>`;
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
      const knowledgePart = event.target.closest(".knowledge-part-link[data-knowledge-part]");
      if (knowledgePart) {
        const part = mount.querySelector(`#knowledge-part-${knowledgePart.dataset.knowledgePart}`);
        part?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const knowledgeTopic = event.target.closest("[data-knowledge-topic]");
      if (knowledgeTopic) {
        event.preventDefault();
        const chapter = mount.querySelector(`[data-knowledge-chapter="${knowledgeTopic.dataset.knowledgeTopic}"]`);
        chapter?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const knowledgeSubchapter = event.target.closest("[data-knowledge-subchapter]");
      if (knowledgeSubchapter) {
        event.preventDefault();
        mount.querySelector(`#${knowledgeSubchapter.dataset.knowledgeSubchapter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
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
      if (!access.premium) return;
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
    const targetSurface = HelpContent.findParentTopic(topicId)?.surface || "help";
    if (targetSurface !== surface) {
      window.navigate(`${targetSurface === "knowledge" ? "/wissen/" : "/hilfe/"}#${topicId}`);
      return;
    }
    selectedTopicId = topicId;
    history.replaceState({}, "", `${surface === "knowledge" ? "/wissen/" : "/hilfe/"}#${topicId}`);
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
