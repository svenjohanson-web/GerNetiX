const ProjectRepositoryCard = (() => {
  function create({ getJson, escapeHtml, escapeAttribute }) {
    let activeProject = null;
    let activeCommitSha = "";
    let requestSequence = 0;
    let renderedProjectKey = "";
    let loadingProjectKey = "";

    function init() {
      const target = document.querySelector("#projectRepositoryCard");
      target?.addEventListener("click", handleClick);
    }

    async function render(project, options = {}) {
      const target = document.querySelector("#projectRepositoryCard");
      if (!target) return;
      activeProject = project || null;
      target.classList.toggle("hidden", !activeProject);
      if (!activeProject) {
        requestSequence += 1;
        renderedProjectKey = "";
        loadingProjectKey = "";
        target.innerHTML = "";
        return;
      }
      const projectKey = `${activeProject.id || activeProject.project_server_id}:${activeProject.updatedAt || ""}`;
      if (!options.force && (projectKey === renderedProjectKey || projectKey === loadingProjectKey)) return;
      loadingProjectKey = projectKey;
      const sequence = ++requestSequence;
      target.innerHTML = loadingMarkup();
      try {
        const base = repositoryBase(activeProject);
        const [status, history] = await Promise.all([
          getJson(base),
          getJson(`${base}/history`),
        ]);
        if (sequence !== requestSequence) return;
        activeCommitSha = status.repository?.head_sha || "";
        const tree = await getJson(`${base}/tree?commit_sha=${encodeURIComponent(activeCommitSha)}`);
        if (sequence !== requestSequence) return;
        target.innerHTML = cardMarkup(status, tree, history);
        renderedProjectKey = projectKey;
        loadingProjectKey = "";
        const firstPath = tree.paths?.[0];
        if (firstPath) await showFile(firstPath, activeCommitSha, sequence);
        else setRepositoryPreview("<p class=\"empty\">Dieses Repository enthält noch keine Dateien.</p>");
      } catch (error) {
        if (sequence === requestSequence) {
          loadingProjectKey = "";
          target.innerHTML = errorMarkup(error);
        }
      }
    }

    async function handleClick(event) {
      const refresh = event.target.closest("[data-repository-refresh]");
      if (refresh) { await render(activeProject, { force: true }); return; }
      const fileButton = event.target.closest("[data-repository-file]");
      if (fileButton) {
        await showFile(fileButton.dataset.repositoryFile, activeCommitSha, requestSequence);
        return;
      }
      const commitButton = event.target.closest("[data-repository-commit]");
      if (commitButton) await selectCommit(commitButton.dataset.repositoryCommit, requestSequence);
    }

    async function selectCommit(commitSha, sequence) {
      if (!activeProject) return;
      activeCommitSha = commitSha;
      setRepositoryPreview("<p class=\"repository-loading\">Commit und Diff werden geladen …</p>");
      try {
        const base = repositoryBase(activeProject);
        const [tree, diff] = await Promise.all([
          getJson(`${base}/tree?commit_sha=${encodeURIComponent(commitSha)}`),
          getJson(`${base}/commits/${encodeURIComponent(commitSha)}/diff`),
        ]);
        if (sequence !== requestSequence) return;
        document.querySelector("#projectRepositoryTree").innerHTML = treeMarkup(tree.paths || []);
        document.querySelectorAll("[data-repository-commit]").forEach((button) => {
          button.classList.toggle("active", button.dataset.repositoryCommit === commitSha);
        });
        setRepositoryPreview(diffMarkup(diff));
      } catch (error) {
        setRepositoryPreview(errorMarkup(error, true));
      }
    }

    async function showFile(path, commitSha, sequence) {
      if (!activeProject) return;
      setRepositoryPreview("<p class=\"repository-loading\">Datei wird geladen …</p>");
      try {
        const file = await getJson(`${repositoryBase(activeProject)}/files/${encodeURIComponent(path)}?commit_sha=${encodeURIComponent(commitSha)}`);
        if (sequence !== requestSequence) return;
        document.querySelectorAll("[data-repository-file]").forEach((button) => {
          button.classList.toggle("active", button.dataset.repositoryFile === path);
        });
        setRepositoryPreview(fileMarkup(file));
      } catch (error) {
        setRepositoryPreview(errorMarkup(error, true));
      }
    }

    function setRepositoryPreview(markup) {
      const preview = document.querySelector("#projectRepositoryPreview");
      if (preview) preview.innerHTML = markup;
    }

    function cardMarkup(status, tree, history) {
      const repository = status.repository || {};
      return `<header class="project-repository-header">
        <div><p class="eyebrow">Versionskontrolle</p><h2>Git-Repository</h2><p>Lesbare Projektdateien und technische Historie.</p></div>
        <button type="button" class="secondary" data-repository-refresh>Neu laden</button>
      </header>
      ${status.contract_stub ? `<p class="repository-contract-note"><strong>Entwicklungsvertrag</strong> Die Ansicht nutzt vorübergehend den Project-Server-Contract-Stub.</p>` : ""}
      <dl class="project-repository-meta">
        <div><dt>Status</dt><dd><span class="repository-state ${escapeAttribute(repository.state || "unknown")}">${escapeHtml(statusLabel(repository.state))}</span></dd></div>
        <div><dt>Branch</dt><dd>${escapeHtml(repository.default_branch || "nicht festgelegt")}</dd></div>
        <div><dt>Head</dt><dd><code title="${escapeAttribute(repository.head_sha || "")}">${escapeHtml(shortSha(repository.head_sha))}</code></dd></div>
        <div><dt>Arbeitsstand</dt><dd>read-only</dd></div>
      </dl>
      <div class="project-repository-workspace">
        <section class="project-repository-tree-panel" aria-labelledby="projectRepositoryTreeTitle">
          <h3 id="projectRepositoryTreeTitle">Dateibaum</h3>
          <div id="projectRepositoryTree" class="project-repository-tree">${treeMarkup(tree.paths || [])}</div>
        </section>
        <section id="projectRepositoryPreview" class="project-repository-preview" aria-live="polite"></section>
        <section class="project-repository-history" aria-labelledby="projectRepositoryHistoryTitle">
          <h3 id="projectRepositoryHistoryTitle">Historie</h3>
          ${historyMarkup(history.items || [], repository.head_sha)}
        </section>
      </div>`;
    }

    function treeMarkup(paths) {
      if (!paths.length) return `<p class="empty">Keine Dateien vorhanden.</p>`;
      return `<ul role="tree">${paths.map((path) => {
        const depth = Math.max(0, String(path).split("/").length - 1);
        const label = String(path).split("/").at(-1);
        return `<li role="treeitem" style="--tree-depth:${depth}"><button type="button" data-repository-file="${escapeAttribute(path)}" title="${escapeAttribute(path)}"><span aria-hidden="true">${fileIcon(path)}</span>${escapeHtml(label)}</button></li>`;
      }).join("")}</ul>`;
    }

    function historyMarkup(items, headSha) {
      if (!items.length) return `<p class="empty">Noch keine Commit-Historie.</p>`;
      return `<ol>${items.map((item) => `<li><button type="button" data-repository-commit="${escapeAttribute(item.commit_sha)}" class="${item.commit_sha === headSha ? "active" : ""}">
        <span class="repository-history-kind">${escapeHtml(kindLabel(item.kind))}</span>
        <strong>${escapeHtml(item.message || "Commit")}</strong>
        <code>${escapeHtml(shortSha(item.commit_sha))}</code>
        ${item.created_at ? `<time datetime="${escapeAttribute(item.created_at)}">${escapeHtml(formatDate(item.created_at))}</time>` : ""}
      </button></li>`).join("")}</ol>`;
    }

    function fileMarkup(file) {
      const heading = `<header><div><p class="eyebrow">Datei</p><h3>${escapeHtml(file.path)}</h3></div><span>${formatBytes(file.size_bytes)}</span></header>`;
      if (file.binary) return `${heading}<p class="repository-file-notice">Binärdatei – keine Textvorschau verfügbar.</p>`;
      if (file.truncated) return `${heading}<p class="repository-file-notice">Die Datei ist für die Browser-Vorschau zu groß.</p>`;
      return `${heading}<pre><code>${escapeHtml(file.content || "")}</code></pre>`;
    }

    function diffMarkup(diff) {
      const files = diff.files || [];
      return `<header><div><p class="eyebrow">Commit-Diff</p><h3>${escapeHtml(shortSha(diff.commit_sha))}</h3></div><span>${files.length} Änderung${files.length === 1 ? "" : "en"}</span></header>${files.length
        ? files.map((file) => `<article class="repository-diff-file"><h4><span>${escapeHtml(diffStatusLabel(file.status))}</span> ${escapeHtml(file.previous_path ? `${file.previous_path} → ${file.path}` : file.path)}</h4>${file.binary ? `<p>Binärdatei geändert.</p>` : file.truncated && !file.patch ? `<p>Der Project Server liefert für diesen Commit nur die geänderten Pfade.</p>` : `<pre><code>${escapeHtml(file.patch || "Kein Textdiff verfügbar.")}</code></pre>`}</article>`).join("")
        : `<p class="empty">Dieser Stand enthält gegenüber seinem Vorgänger keine Dateiänderung.</p>`}`;
    }

    function loadingMarkup() {
      return `<header class="project-repository-header"><div><p class="eyebrow">Versionskontrolle</p><h2>Git-Repository</h2></div></header><p class="repository-loading">Repository-Status wird geladen …</p>`;
    }

    function errorMarkup(error, compact = false) {
      const conflict = error?.code === "repository_head_conflict" || error?.status === 409;
      const text = conflict
        ? "Der Repository-Stand hat sich geändert. Lade die Karte neu; lokale Eingaben wurden nicht überschrieben."
        : error?.status === 404
          ? "Repository, Commit oder Datei ist für dieses Projekt nicht verfügbar."
          : error?.message || "Repository-Daten konnten nicht geladen werden.";
      return `<div class="repository-error ${conflict ? "conflict" : ""}" role="alert"><strong>${conflict ? "Standkonflikt" : "Repository nicht verfügbar"}</strong><p>${escapeHtml(text)}</p>${compact ? "" : `<button type="button" data-repository-refresh>Erneut laden</button>`}</div>`;
    }

    return { init, render };
  }

  function repositoryBase(project) {
    return `/api/platform/projects/${encodeURIComponent(project.id || project.project_server_id)}/repository`;
  }

  function shortSha(value) {
    return String(value || "").slice(0, 10) || "noch keiner";
  }

  function statusLabel(value) {
    return ({ active: "Aktiv", contract_stub: "Stub bereit", provisioning: "Wird angelegt", failed: "Fehler" })[value] || String(value || "Unbekannt");
  }

  function kindLabel(value) {
    return ({ working_head: "Arbeitsstand", snapshot: "Benannte Version", restore: "Wiederherstellung" })[value] || "Git-Commit";
  }

  function diffStatusLabel(value) {
    return ({ added: "Neu", modified: "Geändert", deleted: "Gelöscht", renamed: "Umbenannt" })[value] || value;
  }

  function fileIcon(path) {
    return /\.(png|jpe?g|gif|webp|ico|bin|elf|hex)$/i.test(path) ? "◆" : "▤";
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (bytes < 1024) return `${bytes} Byte`;
    return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KiB`;
  }

  return { create };
})();

export {
  ProjectRepositoryCard,
};

/* ---- Uebergangsbruecke ---- */
/*
 * Noch klassisch und liest diese Namen global: app-shell-controller.js, app.js.
 * Verschwindet mit dem letzten davon.
 */
Object.assign(globalThis, {
  ProjectRepositoryCard,
});
/* ---- /Uebergangsbruecke ---- */
