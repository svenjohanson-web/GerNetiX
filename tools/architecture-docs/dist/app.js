(function () {
  const model = window.ARCHITECTURE_DOCS || { categories: [], statusDefinitions: {}, documents: [] };
  const documentsById = new Map(model.documents.map((document) => [document.id, document]));
  const documentsByPath = new Map(model.documents.map((document) => [normalizePath(document.sourcePath), document]));
  const navigation = document.querySelector("#documentationNavigation");
  const content = document.querySelector("#documentationContent");
  const context = document.querySelector("#documentContext");
  const search = document.querySelector("#documentationSearch");

  search.addEventListener("input", renderNavigation);
  window.addEventListener("hashchange", renderDocument);
  renderNavigation();
  renderDocument();

  function activeDocumentId() {
    return window.location.hash.match(/^#\/doc\/(.+)$/)?.[1] || "architecture-home";
  }

  function renderNavigation() {
    const query = search.value.trim().toLocaleLowerCase("de");
    const visible = model.documents.filter((document) => !query || searchableText(document).includes(query));
    navigation.innerHTML = query ? `<p class="search-results-note">${visible.length} Treffer</p>` : "";
    for (const category of model.categories) {
      const categoryDocuments = visible.filter((document) => document.category === category.id);
      if (!categoryDocuments.length) continue;
      navigation.insertAdjacentHTML("beforeend", `
        <section class="navigation-section">
          <h2>${escapeHtml(category.label)}</h2>
          ${categoryDocuments.map((document) => `
            <a href="#/doc/${escapeAttribute(document.id)}" class="${document.id === activeDocumentId() ? "active" : ""}">${escapeHtml(document.title)}</a>
          `).join("")}
        </section>
      `);
    }
    if (!visible.length) navigation.innerHTML = '<p class="empty-state">Keine passende Dokumentation gefunden.</p>';
  }

  function renderDocument() {
    const documentModel = documentsById.get(activeDocumentId()) || documentsById.get("architecture-home");
    if (!documentModel) return;
    const category = model.categories.find((item) => item.id === documentModel.category);
    content.innerHTML = `
      <header class="document-header">
        <p class="eyebrow">${escapeHtml(category?.label || "Dokumentation")}</p>
        <h2>${escapeHtml(documentModel.title)}</h2>
        <p>${escapeHtml(documentModel.summary || "Architekturquelle ohne Kurzbeschreibung.")}</p>
      </header>
      <article class="markdown-body">${renderMarkdown(documentModel.content || "", documentModel.sourcePath)}</article>
    `;
    renderContext(documentModel, category);
    renderNavigation();
    content.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderContext(documentModel, category) {
    const status = model.statusDefinitions[documentModel.status] || { label: documentModel.status, tone: "reconstructed" };
    context.innerHTML = `
      <h2>Dokumentkontext</h2>
      <dl class="context-list">
        <div><dt>Status</dt><dd><span class="status-badge ${escapeAttribute(status.tone)}">${escapeHtml(status.label)}</span></dd></div>
        <div><dt>Thema</dt><dd>${escapeHtml(category?.label || documentModel.category)}</dd></div>
        <div><dt>Quelle</dt><dd><code>${escapeHtml(documentModel.sourcePath)}</code></dd></div>
      </dl>
    `;
  }

  function renderMarkdown(markdown, sourcePath) {
    const lines = String(markdown).replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let index = 0;
    let listType = "";

    function closeList() {
      if (!listType) return;
      html.push(`</${listType}>`);
      listType = "";
    }

    while (index < lines.length) {
      const line = lines[index];
      if (line.startsWith("```")) {
        closeList();
        const language = line.slice(3).trim();
        const code = [];
        index += 1;
        while (index < lines.length && !lines[index].startsWith("```")) code.push(lines[index++]);
        html.push(`<pre><code data-language="${escapeAttribute(language)}">${escapeHtml(code.join("\n"))}</code></pre>`);
        index += 1;
        continue;
      }
      if (isTableHeader(lines, index)) {
        closeList();
        const headers = tableCells(line);
        index += 2;
        const rows = [];
        while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) rows.push(tableCells(lines[index++]));
        html.push(`<table><thead><tr>${headers.map((cell) => `<th>${renderInline(cell, sourcePath)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell, sourcePath)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
        continue;
      }
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        closeList();
        const level = heading[1].length;
        html.push(`<h${level}>${renderInline(heading[2], sourcePath)}</h${level}>`);
        index += 1;
        continue;
      }
      const unordered = line.match(/^\s*[-*]\s+(.+)$/);
      const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
      if (unordered || ordered) {
        const requestedType = unordered ? "ul" : "ol";
        if (listType !== requestedType) {
          closeList();
          listType = requestedType;
          html.push(`<${listType}>`);
        }
        html.push(`<li>${renderInline((unordered || ordered)[1], sourcePath)}</li>`);
        index += 1;
        continue;
      }
      if (/^>\s?/.test(line)) {
        closeList();
        const quote = [];
        while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ""));
        html.push(`<blockquote>${renderInline(quote.join(" "), sourcePath)}</blockquote>`);
        continue;
      }
      if (!line.trim()) {
        closeList();
        index += 1;
        continue;
      }
      closeList();
      const paragraph = [line.trim()];
      index += 1;
      while (index < lines.length && lines[index].trim() && !startsBlock(lines, index)) paragraph.push(lines[index++].trim());
      html.push(`<p>${renderInline(paragraph.join(" "), sourcePath)}</p>`);
    }
    closeList();
    return html.join("\n");
  }

  function renderInline(value, sourcePath) {
    let result = escapeHtml(value);
    result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, target) => `<img src="${escapeAttribute(resolveAsset(target, sourcePath))}" alt="${escapeAttribute(alt)}" />`);
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, target) => {
      const href = resolveLink(target, sourcePath);
      const external = /^https?:/i.test(href) ? ' target="_blank" rel="noreferrer"' : "";
      return `<a href="${escapeAttribute(href)}"${external}>${label}</a>`;
    });
    result = result.replace(/`([^`]+)`/g, "<code>$1</code>");
    result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return result;
  }

  function resolveLink(target, sourcePath) {
    if (/^(https?:|mailto:|#)/i.test(target)) return target;
    const resolved = resolveSourcePath(target, sourcePath);
    const targetDocument = documentsByPath.get(resolved.replace(/#.*$/, ""));
    return targetDocument ? `#/doc/${targetDocument.id}` : resolveAsset(target, sourcePath);
  }

  function resolveAsset(target, sourcePath) {
    if (/^(https?:|data:|#)/i.test(target)) return target;
    return `../../../${resolveSourcePath(target, sourcePath)}`;
  }

  function resolveSourcePath(target, sourcePath) {
    const cleanTarget = target.split("#")[0];
    const base = normalizePath(sourcePath).split("/").slice(0, -1);
    for (const part of cleanTarget.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") base.pop();
      else base.push(part);
    }
    return base.join("/");
  }

  function isTableHeader(lines, index) {
    return /^\s*\|.*\|\s*$/.test(lines[index] || "") && /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(lines[index + 1] || "");
  }

  function tableCells(line) {
    return line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
  }

  function startsBlock(lines, index) {
    const line = lines[index] || "";
    return line.startsWith("```") || /^(#{1,3})\s/.test(line) || /^\s*[-*]\s/.test(line) || /^\s*\d+\.\s/.test(line) || /^>\s?/.test(line) || isTableHeader(lines, index);
  }

  function searchableText(documentModel) {
    return `${documentModel.title} ${documentModel.summary} ${documentModel.content}`.toLocaleLowerCase("de");
  }

  function normalizePath(value) {
    return String(value || "").replace(/\\/g, "/");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }
})();
