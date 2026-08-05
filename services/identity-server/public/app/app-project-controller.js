// GerNetiX platform module extracted from app.js.
async function openProjectInIde(projectId) {
  state.activeProjectId = projectId;
  await postJson("/api/platform/workspace-state", {
    lastProjectId: projectId,
    lastMode: "ide",
    lastRoute: `/app/ide/?project=${encodeURIComponent(projectId)}`,
  });
  navigate(`/app/ide/?project=${encodeURIComponent(projectId)}`);
}

function renderProjects() {
  const projectList = document.querySelector("#projectList");
  if (!projectList) return;
  const allCatalogProjects = learningCatalogProjects();
  const categoryFilter = document.querySelector("#learningCatalogCategory");
  const tagFilter = document.querySelector("#learningCatalogTag");
  const availableTags = Array.from(new Set(allCatalogProjects.flatMap((project) => project.tags || []))).sort();
  if (categoryFilter) {
    categoryFilter.value = state.learningCatalogCategory;
    categoryFilter.onchange = () => {
      state.learningCatalogCategory = categoryFilter.value;
      renderProjects();
    };
  }
  if (tagFilter) {
    tagFilter.innerHTML = `<option value="all">${escapeHtml(learningText("allTags", "Alle Tags"))}</option>${availableTags.map((tag) => `
      <option value="${escapeAttribute(tag)}"${tag === state.learningCatalogTag ? " selected" : ""}>${escapeHtml(learningTagLabel(tag))}</option>
    `).join("")}`;
    if (state.learningCatalogTag !== "all" && !availableTags.includes(state.learningCatalogTag)) state.learningCatalogTag = "all";
    tagFilter.value = state.learningCatalogTag;
    tagFilter.onchange = () => {
      state.learningCatalogTag = tagFilter.value;
      renderProjects();
    };
  }
  const requestedCatalogSlug = new URLSearchParams(window.location.search).get("catalog") || "";
  const catalogProjects = allCatalogProjects.filter((project) => {
    const categoryMatches = state.learningCatalogCategory === "all" || project.learningCategory === state.learningCatalogCategory;
    const tagMatches = state.learningCatalogTag === "all" || project.tags?.includes(state.learningCatalogTag);
    return categoryMatches && tagMatches;
  }).sort((left, right) => Number(right.slug === requestedCatalogSlug) - Number(left.slug === requestedCatalogSlug));
  projectList.innerHTML = catalogProjects.length ? catalogProjects.map((project) => `
    <a class="project-card learning-catalog-card${project.slug === requestedCatalogSlug ? " is-linked" : ""} learning-project-tile"
      href="/app/learning-project-overview/?project=${encodeURIComponent(project.id)}"
      data-open-learning-project-overview="${escapeAttribute(project.id)}"
      data-catalog-slug="${escapeAttribute(project.slug)}">
      <div>
        <div class="learning-catalog-card-head">
          <p class="eyebrow">${escapeHtml(learningHeadlineLabel(project))}</p>
          <span class="learning-access-badge ${escapeAttribute(project.accessModel || "subscription")}">${escapeHtml(learningAccessLabel(project.accessModel))}</span>
        </div>
        <h2>${escapeHtml(project.name)}</h2>
        <p>${escapeHtml(project.description)}</p>
      </div>
      <div class="learning-classification">
        <span class="learning-category-badge">${escapeHtml(learningCategoryLabel(project.learningCategory))}</span>
        <ul class="learning-tag-list" aria-label="Tags">
          ${(project.tags || []).map((tag) => `<li>${escapeHtml(learningTagLabel(tag))}</li>`).join("")}
        </ul>
      </div>
    </a>
  `).join("") : `<p class="empty">${escapeHtml(learningText("emptyCatalog", "Im Lernprojekt-Katalog sind noch keine Projekte verfügbar."))}</p>`;
  document.querySelectorAll("#projectList [data-open-learning-project-overview]").forEach((tile) => {
    tile.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(`/app/learning-project-overview/?project=${encodeURIComponent(tile.dataset.openLearningProjectOverview)}`);
    });
  });
  if (requestedCatalogSlug) {
    projectList.querySelector(`[data-catalog-slug="${CSS.escape(requestedCatalogSlug)}"]`)?.scrollIntoView({ block: "center" });
  }
}

function renderLearningProjectOverview() {
  const target = document.querySelector("#learningProjectOverview");
  if (!target) return;
  const query = new URLSearchParams(window.location.search);
  const projectId = query.get("project") || "";
  const catalogSlug = query.get("catalog") || "";
  const project = learningCatalogProjects().find((item) => item.id === projectId || item.slug === catalogSlug);
  if (!project) {
    target.innerHTML = `
      <p class="eyebrow">${escapeHtml(learningText("notFoundEyebrow", "Lernprojekt"))}</p>
      <h2>${escapeHtml(learningText("notFoundTitle", "Projekt nicht gefunden"))}</h2>
      <p class="helper-text">${escapeHtml(learningText("notFoundText", "Dieses Lernprojekt ist im aktuellen Katalog nicht verfügbar."))}</p>
      <div class="button-row learning-project-overview-actions">
        <button type="button" data-back-to-learning-catalog>${escapeHtml(learningText("back", "Zurück"))}</button>
      </div>
    `;
  } else {
    const lessons = project.developmentLessons || [];
    target.innerHTML = `
      <header class="learning-project-overview-head">
        <p class="eyebrow">${escapeHtml(learningHeadlineLabel(project))}</p>
        <h2>${escapeHtml(project.name)}</h2>
        <p>${escapeHtml(project.description)}</p>
      </header>
      ${project.projectStory?.problem ? `
        <section class="learning-project-story-summary">
          <h3>${escapeHtml(learningText("about", "Worum geht es in diesem Projekt?"))}</h3>
          <p>${escapeHtml(project.projectStory.problem)}</p>
          ${project.projectStory.learning_goal ? `<div><strong>${escapeHtml(learningText("learningGoal", "Was du lernst"))}</strong><p>${escapeHtml(project.projectStory.learning_goal)}</p></div>` : ""}
          ${project.projectStory.working_method ? `<div><strong>${escapeHtml(learningText("workingMethod", "So arbeitest du"))}</strong><p>${escapeHtml(project.projectStory.working_method)}</p></div>` : ""}
          ${project.projectStory.result ? `<div><strong>${escapeHtml(learningText("result", "Dein Ergebnis"))}</strong><p>${escapeHtml(project.projectStory.result)}</p></div>` : ""}
        </section>
      ` : ""}
      ${project.customerEntries?.length ? `
        <section class="learning-product-entries" aria-labelledby="learningProductEntriesTitle">
          <header>
            <p class="eyebrow">Dein Einstieg</p>
            <h3 id="learningProductEntriesTitle">Was möchtest du mit ${escapeHtml(project.name)} machen?</h3>
            <p>Das fertige Produkt, der Nachbau, das Lernprojekt und deine eigene Weiterentwicklung bleiben klar getrennt.</p>
          </header>
          <div class="learning-product-entry-grid">
            ${project.customerEntries.map((entry) => renderCustomerEntry(project, entry)).join("")}
          </div>
        </section>
      ` : ""}
      <section class="learning-project-lesson-overview">
        <header>
          <p class="eyebrow">${escapeHtml(learningText("structureEyebrow", "Projektaufbau"))}</p>
          <h3>${escapeHtml(learningText("structureTitle", "So ist das Projekt aufgebaut"))}</h3>
          <p>${escapeHtml(learningText("structureText", "Die Etappen führen dich vom Einstieg bis zum praktisch geprüften Projektergebnis."))}</p>
        </header>
        ${lessons.length ? `
          <ol>
            ${lessons.map((lesson) => `
              <li>
                <span>${escapeHtml(String(lesson.order_index || ""))}</span>
                <div>
                  <strong>${escapeHtml(lesson.title)}</strong>
                  <p>${escapeHtml(lesson.summary)}</p>
                  <small>${escapeHtml(lesson.standalone_start?.hardware_required
                    ? learningText("hardware", "Praxisabschnitt mit ESP32")
                    : learningText("noHardware", "Ohne zusätzliche Hardware"))}</small>
                </div>
              </li>
            `).join("")}
          </ol>
        ` : `<p class="empty">${escapeHtml(learningText("noLessons", "Die Lessons für dieses Lernprojekt werden noch zugeordnet."))}</p>`}
      </section>
      <div class="button-row learning-project-overview-actions">
        <button type="button" data-back-to-learning-catalog>${escapeHtml(learningText("back", "Zurück"))}</button>
        <button class="primary" type="button" data-start-learning-project="${escapeAttribute(project.id)}">${escapeHtml(learningText("startProject", "Lernprojekt starten"))}</button>
      </div>
    `;
  }
  target.querySelector("[data-back-to-learning-catalog]")?.addEventListener("click", () => navigate("/app/learn/"));
  target.querySelector("[data-start-learning-project]")?.addEventListener("click", (event) => {
    learningProject().open(event.currentTarget.dataset.startLearningProject);
  });
  target.querySelectorAll("[data-start-learning-entry]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.learningEntryKind;
      if (kind === "develop") { learningProject().openDevelopment(button.dataset.startLearningEntry); return; }
      learningProject().open(button.dataset.startLearningEntry, {
        startViewId: kind === "build" ? "nexi-build" : "nexi-local",
      });
    });
  });
  target.querySelectorAll("[data-open-customer-project-app]").forEach((button) => {
    button.addEventListener("click", () => navigate(`/app/project-app/?project=${encodeURIComponent(button.dataset.openCustomerProjectApp)}`));
  });
  const requestedEntry = project ? query.get("entry") : "";
  const requestedButton = requestedEntry
    ? target.querySelector(`[data-learning-entry-kind="${CSS.escape(requestedEntry)}"]`)
    : null;
  if (requestedButton) {
    query.delete("entry");
    window.history.replaceState({}, "", `${window.location.pathname}${query.size ? `?${query}` : ""}`);
    requestedButton.click();
  }
}

function renderCustomerEntry(catalogProject, entry) {
  const instance = state.projects.find((project) => (
    project.projectOrigin === "account_project" && project.slug === catalogProject.slug
  ));
  const availability = entry.id === "use" && instance ? "available" : entry.availability;
  let action = `<button type="button" disabled>${escapeHtml(availability === "requires_instance" ? "Nach Einrichtung verfügbar" : "Wird vorbereitet")}</button>`;
  if (availability === "available" && entry.id === "use") {
    action = `<button type="button" data-open-customer-project-app="${escapeAttribute(instance.id)}">Nexi öffnen</button>`;
  } else if (availability === "available") {
    const label = ({ build: "Nachbau starten", learn: "Lernprojekt starten", develop: "In der IDE weiterentwickeln" })[entry.id] || "Öffnen";
    action = `<button type="button" data-start-learning-entry="${escapeAttribute(catalogProject.id)}" data-learning-entry-kind="${escapeAttribute(entry.id)}">${escapeHtml(label)}</button>`;
  }
  return `
    <article class="learning-product-entry is-${escapeAttribute(availability || "preparing")}">
      <div><span>${escapeHtml(customerEntryAvailabilityLabel(availability))}</span><h4>${escapeHtml(entry.title)}</h4><p>${escapeHtml(entry.summary)}</p></div>
      ${action}
    </article>
  `;
}

function customerEntryAvailabilityLabel(availability) {
  if (availability === "available") return "Jetzt verfügbar";
  if (availability === "requires_instance") return "Benötigt eine eingerichtete Instanz";
  return "In Vorbereitung";
}

function learningCategoryLabel(category) {
  const labels = {
    de: { software_engineering: "Software Engineering", desktop: "PC / Mac", embedded: "Embedded", distributed_system: "Verteilte Systeme", mobile: "Mobile", fallback: "Lernprojekt" },
    en: { software_engineering: "Software engineering", desktop: "PC / Mac", embedded: "Embedded", distributed_system: "Distributed systems", mobile: "Mobile", fallback: "Learning project" },
    nl: { software_engineering: "Software-engineering", desktop: "PC / Mac", embedded: "Embedded", distributed_system: "Gedistribueerde systemen", mobile: "Mobiel", fallback: "Leerproject" },
  };
  const localized = labels[currentLearningLocale()] || labels.de;
  return localized[category] || localized.fallback;
}

function learningTagLabel(tag) {
  const labels = {
    de: {
    "client:mobile": "Mobile",
    "level:beginner": "Einsteiger",
    "platform:arduino": "Arduino",
    "platform:avr": "AVR",
    "platform:esp32": "ESP32",
    "platform:raspberry-pi": "Raspberry Pi",
    "platform:stm32": "STM32",
    "protocol:mqtt": "MQTT",
    "runtime:browser": "Browser",
    "topic:actuators": "Aktoren",
    "topic:motor-control": "Motoransteuerung",
    "topic:ai": "KI",
    "topic:automation": "Automatisierung",
    "topic:bare-metal": "Bare Metal",
    "topic:firmware": "Firmware",
    "topic:home-automation": "Hausautomation",
    "topic:modeling": "Modellierung",
    "topic:privacy": "Datenschutz",
    "topic:programming": "Programmierung",
    "topic:radar": "Radar",
    "topic:radio": "Funk",
    "topic:camera": "Kamera",
    "topic:networking": "Netzwerke",
    "topic:sensors": "Sensoren",
    "topic:data": "Daten",
    "topic:databases": "Datenbanken",
    "topic:storage": "Speicher",
    "topic:video": "Video",
    "topic:web-push": "Web Push",
    },
    en: {
      "client:mobile": "Mobile", "level:beginner": "Beginner", "topic:actuators": "Actuators", "topic:ai": "AI",
      "topic:automation": "Automation", "topic:home-automation": "Home automation", "topic:modeling": "Modelling",
      "topic:privacy": "Privacy", "topic:programming": "Programming", "topic:radio": "Radio", "topic:camera": "Camera", "topic:networking": "Networking", "topic:sensors": "Sensors", "topic:data": "Data", "topic:databases": "Databases",
      "topic:storage": "Storage", "topic:video": "Video",
    },
    nl: {
      "client:mobile": "Mobiel", "level:beginner": "Beginner", "topic:actuators": "Actuatoren", "topic:ai": "AI",
      "topic:automation": "Automatisering", "topic:home-automation": "Domotica", "topic:modeling": "Modellering",
      "topic:privacy": "Privacy", "topic:programming": "Programmeren", "topic:radio": "Radio", "topic:camera": "Camera", "topic:networking": "Netwerken", "topic:sensors": "Sensoren", "topic:data": "Gegevens", "topic:databases": "Databases",
      "topic:storage": "Opslag", "topic:video": "Video",
    },
  };
  return labels[currentLearningLocale()]?.[tag] || labels.de[tag] || String(tag || "").split(":").pop();
}

function learningHeadlineLabel(project) {
  const primaryTopic = (project.tags || []).find((tag) => String(tag).startsWith("topic:"));
  const labels = {
    de: {
    "topic:actuators": "Aktorik",
    "topic:motor-control": "Motoransteuerung",
    "topic:ai": "Künstliche Intelligenz",
    "topic:automation": "Automatisierung",
    "topic:bare-metal": "Bare Metal",
    "topic:firmware": "Firmware",
    "topic:home-automation": "Hausautomation",
    "topic:modeling": "Modellierung",
    "topic:programming": "Programmierung",
    "topic:radar": "Radartechnik",
    "topic:sensors": "Sensorik",
    "topic:data": "Daten",
    "topic:databases": "Datenbanken",
    "topic:storage": "Speicher",
    "topic:web-push": "Web Push",
    },
    en: {
      "topic:actuators": "Actuators", "topic:motor-control": "Motor control", "topic:ai": "Artificial intelligence", "topic:automation": "Automation",
      "topic:home-automation": "Home automation", "topic:modeling": "Modelling", "topic:programming": "Programming",
      "topic:radar": "Radar technology", "topic:sensors": "Sensors", "topic:data": "Data", "topic:databases": "Databases",
      "topic:storage": "Storage",
    },
    nl: {
      "topic:actuators": "Actuatoren", "topic:motor-control": "Motorbesturing", "topic:ai": "Kunstmatige intelligentie", "topic:automation": "Automatisering",
      "topic:home-automation": "Domotica", "topic:modeling": "Modellering", "topic:programming": "Programmeren",
      "topic:radar": "Radartechniek", "topic:sensors": "Sensoren", "topic:data": "Gegevens", "topic:databases": "Databases",
      "topic:storage": "Opslag",
    },
  };
  return labels[currentLearningLocale()]?.[primaryTopic] || labels.de[primaryTopic] || learningCategoryLabel(project.learningCategory);
}

function learningAccessLabel(accessModel) {
  const labels = {
    de: { free: "Frei verfügbar", purchased: "Kurs gekauft", subscription: "Im Abo enthalten" },
    en: { free: "Available free", purchased: "Course purchased", subscription: "Included in subscription" },
    nl: { free: "Gratis beschikbaar", purchased: "Cursus gekocht", subscription: "In abonnement inbegrepen" },
  };
  const localized = labels[currentLearningLocale()] || labels.de;
  return localized[accessModel] || localized.subscription;
}

function renderLearn() {
  const learnProjectList = document.querySelector("#learnProjectList");
  if (!learnProjectList) return;
  const personalProjects = personalLearningProjects();
  const filteredProjects = personalProjects.filter((project) => learningProjectFilter(project, progressFor(project.id)) === state.projectFilter || state.projectFilter === "all");
  learnProjectList.innerHTML = filteredProjects.length ? `
    <table class="learning-project-table">
      <thead>
        <tr>
          <th>${escapeHtml(learningText("project", "Projekt"))}</th>
          <th>${escapeHtml(learningText("status", "Status"))}</th>
          <th>${escapeHtml(learningText("progress", "Fortschritt"))}</th>
          <th>${escapeHtml(learningText("device", "Device"))}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${filteredProjects.map((project) => {
    const progress = progressFor(project.id);
    const hasProgress = progress.currentStep > 0 || progress.completedSteps.length > 0;
    const progressText = `${progress.completedSteps.length}/${project.steps.length}`;
    return `
          <tr>
            <td>
              <strong>${escapeHtml(project.name)}</strong>
              <span>${escapeHtml(project.courseId)} · ${escapeHtml(project.lessonId)}</span>
            </td>
            <td><span class="project-status ${learningProjectFilter(project, progress)}">${learningProjectStatus(project, progress)}</span></td>
            <td>${escapeHtml(progressText)}</td>
            <td>${escapeHtml(project.linkedDeviceId || learningText("noDevice", "kein Device"))}</td>
            <td><div class="button-row"><button type="button" data-open-project="${escapeHtml(project.id)}">${escapeHtml(hasProgress ? learningText("continue", "Fortsetzen") : learningText("start", "Starten"))}</button>${hasProjectApp(project) ? `<button type="button" data-open-project-app="${escapeAttribute(project.id)}">Projekt-App</button>` : ""}</div></td>
          </tr>
    `;
  }).join("")}
      </tbody>
    </table>
  ` : `<p class="empty">${escapeHtml(learningText("emptyPersonal", "Keine Projekte für diesen Filter."))}</p>`;
  document.querySelectorAll("#learnProjectList [data-open-project]").forEach((button) => {
    button.addEventListener("click", () => learningProject().open(button.dataset.openProject));
  });
  document.querySelectorAll("#learnProjectList [data-open-project-app]").forEach((button) => {
    button.addEventListener("click", () => navigate(`/app/project-app/?project=${encodeURIComponent(button.dataset.openProjectApp)}`));
  });
}

function hasProjectApp(project) {
  return (project.sourceFiles || []).some((source) => source.path === "project-app/manifest.json");
}

function personalLearningProjects() {
  return state.projects
    .filter((project) => project.projectOrigin === "account_project" || hasStartedLearningProject(project.id))
    .map((project) => LearningProjectLocales.project(project, currentLearningLocale()));
}

function learningCatalogProjects() {
  return state.projects
    .filter((project) => project.projectOrigin !== "account_project")
    .map((project) => LearningProjectLocales.project(project, currentLearningLocale()));
}

function currentLearningLocale() {
  return platformI18n?.locale || document.documentElement.lang || "de";
}

function learningText(key, fallback) {
  return LearningProjectLocales.text(currentLearningLocale(), key, fallback);
}

function accountDevelopmentProjects() {
  return state.projects.filter((project) => project.projectOrigin === "account_project"
    && ["development_project", "custom_project"].includes(project.type));
}

function hasStartedLearningProject(projectId) {
  const progress = state.progress.find((item) => item.projectId === projectId);
  return Boolean(progress && (progress.updatedAt || progress.currentStep > 0 || progress.completedSteps?.length));
}

function learningProjectStatus(project, progress) {
  if (progress.completedSteps.length >= project.steps.length) return learningText("finished", "abgeschlossen");
  if (progress.currentStep > 0 || progress.completedSteps.length > 0) return learningText("running", "laufend");
  return learningText("ready", "bereit");
}

function learningProjectFilter(project, progress) {
  if (progress.completedSteps.length >= project.steps.length) return "finished";
  if (progress.currentStep > 0 || progress.completedSteps.length > 0) return "in_progress";
  return "not_started";
}
