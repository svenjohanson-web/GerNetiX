const engine = window.RequirementsEngine;

const STEPS = [
  { id: "brief", label: "Dein erster Vorschlag", short: "Formulieren" },
  { id: "mirror", label: "KI-Verständnisspiegel", short: "Verstehen" },
  { id: "knowledge", label: "Fachwissen erweitern", short: "Entdecken" },
  { id: "types", label: "Anforderungsarten", short: "Einordnen" },
  { id: "traps", label: "Typische Fallen", short: "Prüfen" },
  { id: "specification", label: "Spezifikation", short: "Verdichten" },
  { id: "result", label: "Lernrückblick", short: "Abschließen" }
];

const initialState = () => ({
  step: 0,
  proposal: "Ein Mitarbeiter soll sich an einer Maschine anmelden können.",
  analysis: null,
  assumptionDecisions: {},
  context: { location: "machine", assets: [], risks: [], offline: "", critical: "" },
  selectedMethod: "",
  expandedMethod: "",
  classificationAnswers: {},
  trapAnswers: {},
  copied: false
});

let state = initialState();

const screen = document.querySelector("#screen");
const stepList = document.querySelector("#stepList");
const progressLabel = document.querySelector("#progressLabel");
const progressPercent = document.querySelector("#progressPercent");
const progressBar = document.querySelector("#progressBar");
const backButton = document.querySelector("#backButton");
const nextButton = document.querySelector("#nextButton");
const restartButton = document.querySelector("#restartButton");
const actionHint = document.querySelector("#actionHint");
const liveRegion = document.querySelector("#liveRegion");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function render() {
  renderNavigation();
  const renderers = [renderBrief, renderMirror, renderKnowledge, renderTypes, renderTraps, renderSpecification, renderResult];
  screen.innerHTML = renderers[state.step]();
  wireCurrentScreen();
  updateActions();
}

function renderNavigation() {
  const percent = Math.round(((state.step + 1) / STEPS.length) * 100);
  progressLabel.textContent = `Schritt ${state.step + 1} von ${STEPS.length}`;
  progressPercent.textContent = `${percent} %`;
  progressBar.style.width = `${percent}%`;
  stepList.innerHTML = STEPS.map((step, index) => {
    const status = index < state.step ? "done" : index === state.step ? "active" : "upcoming";
    const marker = index < state.step ? "✓" : index + 1;
    return `<li class="step-item ${status}" ${index === state.step ? 'aria-current="step"' : ""}>
      <span class="step-marker">${marker}</span>
      <span><small>${escapeHtml(step.short)}</small>${escapeHtml(step.label)}</span>
    </li>`;
  }).join("");
}

function renderBrief() {
  return `
    <div class="screen-heading">
      <span class="eyebrow">Praxisfall · Zugang an einer Maschine</span>
      <h2>Was soll geschehen?</h2>
      <p>Schreibe deinen ersten Gedanken so auf, wie du ihn einer KI spontan geben würdest. Unvollständig ist ausdrücklich erlaubt.</p>
    </div>
    <div class="learning-callout">
      <span class="callout-icon" aria-hidden="true">1</span>
      <div><strong>Heute zählt nicht der perfekte Prompt.</strong><p>Du lernst, welche fachlichen Entscheidungen hinter einem scheinbar einfachen Satz stecken.</p></div>
    </div>
    <label class="proposal-field" for="proposalInput">
      <span>Dein Vorschlag</span>
      <textarea id="proposalInput" rows="6" maxlength="700">${escapeHtml(state.proposal)}</textarea>
      <small><span id="characterCount">${state.proposal.length}</span> / 700 Zeichen · Strg/⌘ + Enter wertet aus</small>
    </label>
    <div class="prompt-examples" aria-label="Beispielvorschläge">
      <span>Zum Ausprobieren:</span>
      <button type="button" data-proposal="Ein Mitarbeiter soll sich an einer Maschine anmelden können.">bewusst ungenau</button>
      <button type="button" data-proposal="Mitarbeiter sollen sich schnell und sicher mit ihrer RFID-Karte anmelden.">mit Qualitätswörtern</button>
      <button type="button" data-proposal="Die Maschine muss PKI verwenden.">Technik statt Ziel</button>
    </div>
    <details class="transparency-note">
      <summary>Wie arbeitet die Lern-KI?</summary>
      <p>Dieser lokale Lernmodus erkennt bewusst ausgewählte Begriffe und Lücken. Er verhält sich reproduzierbar, überträgt keine Eingaben und macht seine Annahmen sichtbar. Eine spätere Plattformintegration kann denselben Ablauf mit einem Sprachmodell ergänzen.</p>
    </details>`;
}

function renderMirror() {
  const analysis = state.analysis || engine.analyseProposal(state.proposal);
  const vague = analysis.vagueTerms.length
    ? `<div class="language-warning"><strong>Dehnbare Wörter gefunden:</strong> ${analysis.vagueTerms.map(escapeHtml).join(", ")}. Sie brauchen ein beobachtbares Kriterium.</div>`
    : "";
  return `
    <div class="screen-heading compact">
      <span class="eyebrow">KI-Verständnisspiegel</span>
      <h2>So habe ich dich verstanden</h2>
      <blockquote>${escapeHtml(state.proposal)}</blockquote>
    </div>
    <div class="understanding-score">
      <div><span>Verständlichkeit dieser ersten Fassung</span><strong>${analysis.score} / 100</strong></div>
      <div class="score-track"><span style="width:${analysis.score}%"></span></div>
      <p>Kein Schulnotenwert: Je mehr die KI annehmen muss, desto niedriger der Wert.</p>
    </div>
    ${vague}
    <div class="mirror-grid">
      ${mirrorColumn("verstanden", "Sicher verstanden", analysis.understood, "✓")}
      ${mirrorColumn("assumed", "Von der KI angenommen", analysis.assumptions.map((item) => item.text), "?")}
      ${mirrorColumn("unclear", "Noch unklar", analysis.unclear, "…")}
    </div>
    <section class="decision-section">
      <div class="section-title"><div><span class="eyebrow">Deine Entscheidung</span><h3>Was soll mit den Annahmen geschehen?</h3></div><span>${Object.keys(state.assumptionDecisions).length} entschieden</span></div>
      <div class="assumption-list">
        ${analysis.assumptions.length ? analysis.assumptions.map(renderAssumption).join("") : `<div class="empty-state">Für diesen Vorschlag wurden keine stillen Standardannahmen erkannt.</div>`}
      </div>
    </section>`;
}

function mirrorColumn(tone, title, items, icon) {
  return `<section class="mirror-card ${tone}">
    <div class="mirror-title"><span>${icon}</span><h3>${title}</h3><strong>${items.length}</strong></div>
    <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>Nichts erkannt.</li>"}</ul>
  </section>`;
}

function renderAssumption(item) {
  const selected = state.assumptionDecisions[item.id];
  return `<article class="assumption-card">
    <div><span class="assumption-tag">Annahme</span><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.text)}</p></div>
    <div class="segmented" role="group" aria-label="Entscheidung zu ${escapeHtml(item.title)}">
      ${decisionButton(item.id, "accept", "Übernehmen", selected)}
      ${decisionButton(item.id, "change", "Ändern", selected)}
      ${decisionButton(item.id, "open", "Offenlassen", selected)}
    </div>
  </article>`;
}

function decisionButton(id, value, label, selected) {
  return `<button type="button" data-assumption="${id}" data-value="${value}" class="${selected === value ? "selected" : ""}" aria-pressed="${selected === value}">${label}</button>`;
}

function renderKnowledge() {
  return `
    <div class="screen-heading compact">
      <span class="eyebrow">Wissen vor Entscheidung</span>
      <h2>„Anmelden“ ist noch kein Verfahren</h2>
      <p>Gute Anforderungen brauchen Kontext. Die KI kann Möglichkeiten erklären, aber sie kennt den Arbeitsalltag und das Risiko nicht automatisch.</p>
    </div>
    <div class="concept-strip">
      <div><span>1</span><strong>Identifikation</strong><small>Wer behauptet die Person zu sein?</small></div>
      <div><span>2</span><strong>Authentifizierung</strong><small>Wie wird die Behauptung geprüft?</small></div>
      <div><span>3</span><strong>Autorisierung</strong><small>Was darf die Person danach?</small></div>
      <div><span>4</span><strong>Sitzung</strong><small>Wie lange gilt der Zugang?</small></div>
    </div>
    <section class="context-panel">
      <div class="section-title"><div><span class="eyebrow">Kontext</span><h3>Was weißt du über den Einsatz?</h3></div><span>„Weiß ich noch nicht“ ist erlaubt.</span></div>
      ${singleChoice("offline", "Muss die Maschine ohne Netzwerk prüfen können?", [["yes", "Ja, mindestens zeitweise"], ["no", "Nein, Netzwerk ist garantiert"], ["unknown", "Noch nicht entschieden"]], state.context.offline)}
      ${singleChoice("critical", "Gibt es besonders kritische Wartungsfunktionen?", [["yes", "Ja, zusätzlicher Schutz nötig"], ["no", "Nein, gleiche Schutzstufe"], ["unknown", "Noch nicht entschieden"]], state.context.critical)}
      <div class="choice-question"><strong>Welche Risiken sind relevant?</strong><div class="choice-pills multi">
        ${multiChoice("risks", "Karte wird weitergegeben", state.context.risks)}
        ${multiChoice("risks", "Nachweis geht verloren", state.context.risks)}
        ${multiChoice("risks", "Netzwerk fällt aus", state.context.risks)}
        ${multiChoice("risks", "Handschuhe / schmutzige Hände", state.context.risks)}
      </div></div>
    </section>
    <section class="knowledge-section">
      <div class="section-title"><div><span class="eyebrow">Verfahrenslandkarte</span><h3>Welche Lösung passt zum Kontext?</h3></div><span>${state.selectedMethod ? "1 Verfahren gewählt" : "Noch keine Wahl"}</span></div>
      <div class="method-grid">${engine.KNOWLEDGE_METHODS.map(renderMethod).join("")}</div>
    </section>`;
}

function singleChoice(name, question, options, selected) {
  return `<div class="choice-question"><strong>${question}</strong><div class="choice-pills" role="group" aria-label="${question}">
    ${options.map(([value, label]) => `<button type="button" data-context="${name}" data-value="${value}" class="${selected === value ? "selected" : ""}" aria-pressed="${selected === value}">${label}</button>`).join("")}
  </div></div>`;
}

function multiChoice(name, value, selected) {
  const active = selected.includes(value);
  return `<button type="button" data-context-multi="${name}" data-value="${escapeHtml(value)}" class="${active ? "selected" : ""}" aria-pressed="${active}">${active ? "✓ " : "+ "}${escapeHtml(value)}</button>`;
}

function renderMethod(method) {
  const selected = state.selectedMethod === method.id;
  const expanded = state.expandedMethod === method.id;
  return `<article class="method-card ${selected ? "selected" : ""}">
    <button type="button" class="method-main" data-method-expand="${method.id}" aria-expanded="${expanded}">
      <span class="method-factor">${escapeHtml(method.factor)}</span><strong>${escapeHtml(method.title)}</strong><p>${escapeHtml(method.summary)}</p><small>${expanded ? "Weniger anzeigen" : "Wichtige Fragen anzeigen"}</small>
    </button>
    ${expanded ? `<ul>${method.questions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
    <button type="button" class="method-select" data-method-select="${method.id}">${selected ? "Ausgewählt ✓" : "Als primäres Verfahren wählen"}</button>
  </article>`;
}

function renderTypes() {
  const answered = Object.keys(state.classificationAnswers).length;
  const correct = engine.CLASSIFICATION_CARDS.filter((card) => state.classificationAnswers[card.id] === card.expected).length;
  return `
    <div class="screen-heading compact">
      <span class="eyebrow">Was, wie gut oder wodurch begrenzt?</span>
      <h2>Anforderungen richtig einordnen</h2>
      <p><strong>Funktional</strong> beschreibt, was das System tut. <strong>NFR</strong> beschreibt, wie gut oder unter welchen Bedingungen. Daneben gibt es Randbedingungen und fachliche Regeln.</p>
    </div>
    <div class="type-legend">
      <div class="functional"><span>F</span><strong>Funktional</strong><small>Was tut das System?</small></div>
      <div class="nfr"><span>N</span><strong>NFR</strong><small>Wie gut / unter welcher Bedingung?</small></div>
      <div class="constraint"><span>R</span><strong>Randbedingung</strong><small>Welche Grenze ist vorgegeben?</small></div>
      <div class="rule"><span>G</span><strong>Fachliche Regel</strong><small>Welche Regel der Domäne gilt?</small></div>
    </div>
    <div class="quiz-summary"><span>${answered} von ${engine.CLASSIFICATION_CARDS.length} beantwortet</span><strong>${correct} richtig</strong></div>
    <div class="classification-list">${engine.CLASSIFICATION_CARDS.map(renderClassificationCard).join("")}</div>
    <div class="insight-box"><strong>Wichtige Falle:</strong> „Nach drei falschen PINs sperren“ dient der Sicherheit, ist aber funktional – weil es konkretes Systemverhalten beschreibt. Eine NFR kann wiederum neue Funktionen notwendig machen.</div>`;
}

function renderClassificationCard(card, index) {
  const answer = state.classificationAnswers[card.id];
  const isCorrect = answer === card.expected;
  return `<article class="classification-card ${answer ? (isCorrect ? "correct" : "incorrect") : ""}">
    <span class="card-number">${index + 1}</span>
    <div class="classification-content"><p>${escapeHtml(card.text)}</p>
      <div class="classification-actions" role="group" aria-label="Anforderungsart auswählen">
        ${classificationButton(card.id, "functional", "Funktional", answer)}
        ${classificationButton(card.id, "nfr", "NFR", answer)}
        ${classificationButton(card.id, "constraint", "Randbedingung", answer)}
        ${classificationButton(card.id, "rule", "Fachliche Regel", answer)}
      </div>
      ${answer ? `<div class="answer-feedback"><strong>${isCorrect ? "Richtig." : `Noch nicht. Richtig ist: ${engine.CATEGORY_LABELS[card.expected]}.`}</strong> ${escapeHtml(card.explanation)}</div>` : ""}
    </div>
  </article>`;
}

function classificationButton(id, value, label, answer) {
  return `<button type="button" data-classification="${id}" data-value="${value}" class="${answer === value ? "selected" : ""}" aria-pressed="${answer === value}">${label}</button>`;
}

function renderTraps() {
  const answered = Object.keys(state.trapAnswers).length;
  return `
    <div class="screen-heading compact">
      <span class="eyebrow">Denkfallen</span>
      <h2>Wo würdest du nachfragen?</h2>
      <p>Wähle jeweils die Rückfrage, die fehlendes Wissen sichtbar macht, statt vorschnell eine technische Lösung zu erfinden.</p>
    </div>
    <div class="trap-progress"><span>${answered} von ${engine.TRAPS.length} Fällen bearbeitet</span><div><span style="width:${answered / engine.TRAPS.length * 100}%"></span></div></div>
    <div class="trap-list">${engine.TRAPS.map(renderTrap).join("")}</div>`;
}

function renderTrap(trap, index) {
  const answer = state.trapAnswers[trap.id];
  const selectedOption = trap.options.find((option) => option.id === answer);
  return `<article class="trap-card">
    <div class="trap-header"><span>Falle ${index + 1}</span><blockquote>„${escapeHtml(trap.quote)}“</blockquote></div>
    <div class="trap-body"><h3>${escapeHtml(trap.question)}</h3>
      <div class="trap-options">${trap.options.map((option) => `<button type="button" data-trap="${trap.id}" data-value="${option.id}" class="${answer === option.id ? (option.correct ? "correct" : "incorrect") : ""}">${escapeHtml(option.label)}</button>`).join("")}</div>
      ${selectedOption ? `<div class="trap-feedback ${selectedOption.correct ? "correct" : "incorrect"}"><strong>${selectedOption.correct ? "Treffer." : "Diese Frage greift zu kurz."}</strong> ${escapeHtml(trap.lesson)}</div>` : ""}
    </div>
  </article>`;
}

function renderSpecification() {
  const spec = engine.buildSpecification(state);
  return `
    <div class="screen-heading compact">
      <span class="eyebrow">Aus Entscheidungen wird eine Spezifikation</span>
      <h2>Dein Anforderungspaket</h2>
      <p>Die Aussagen sind nach ihrer Rolle getrennt. Offene Fragen bleiben sichtbar, statt von der KI still beantwortet zu werden.</p>
    </div>
    <div class="spec-toolbar">
      <div><span class="status-dot"></span><strong>Entwurf</strong><small>aus deinen Lernentscheidungen</small></div>
      <button type="button" id="copySpecButton">${state.copied ? "Kopiert ✓" : "Als Text kopieren"}</button>
    </div>
    <article class="spec-document" id="specDocument">
      ${specSection("Ziel", [spec.goal], "target")}
      ${specSection("Funktionale Anforderungen", spec.functional, "functional")}
      ${specSection("Nicht-funktionale Anforderungen", spec.nfr, "nfr")}
      ${specSection("Randbedingungen", spec.constraints, "constraint")}
      ${specSection("Fachliche Regeln", spec.rules, "rule")}
      ${specSection("Akzeptanzkriterien", spec.acceptance, "acceptance")}
      ${specSection("Offene Fragen", spec.open, "open")}
    </article>`;
}

function specSection(title, items, tone) {
  return `<section class="spec-section ${tone}"><h3>${title}</h3><ol>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></section>`;
}

function renderResult() {
  const result = engine.calculateResult(state);
  const level = result.points >= 85 ? "Sehr sicher" : result.points >= 70 ? "Gute Grundlage" : "Weiter üben";
  return `
    <div class="result-hero">
      <div class="result-ring" style="--result:${result.points * 3.6}deg"><span><strong>${result.points}</strong><small>/ 100</small></span></div>
      <div><span class="eyebrow">Lernprojekt abgeschlossen</span><h2>${level}: Du machst Annahmen sichtbar.</h2><p>Deine Spezifikation trennt Funktion, Qualität, Regeln und offene Entscheidungen. Genau das reduziert Missverständnisse zwischen Fachseite, Entwicklung und KI.</p></div>
    </div>
    <div class="result-grid">
      <article><span class="result-icon">${result.classificationCorrect}/${engine.CLASSIFICATION_CARDS.length}</span><h3>Anforderungsarten</h3><p>richtig zugeordnet</p></article>
      <article><span class="result-icon">${result.trapsCorrect}/${engine.TRAPS.length}</span><h3>Denkfallen</h3><p>fachlich erkannt</p></article>
      <article><span class="result-icon">${state.selectedMethod ? "1" : "0"}</span><h3>Verfahren</h3><p>bewusst ausgewählt</p></article>
    </div>
    <section class="takeaway-card">
      <span class="eyebrow">Dein Merksatz</span>
      <blockquote>Schreibe Anforderungen so, dass die KI möglichst wenig annehmen muss – und erkenne, wo dir für eine gute Entscheidung noch Fachwissen fehlt.</blockquote>
    </section>
    <section class="learned-list">
      <h3>Das kannst du jetzt</h3>
      <ul>
        <li><span>✓</span>die Interpretation einer KI von deiner eigentlichen Absicht unterscheiden</li>
        <li><span>✓</span>Identifikation, Authentifizierung und Autorisierung auseinanderhalten</li>
        <li><span>✓</span>funktionale Anforderungen, NFR, Randbedingungen und fachliche Regeln trennen</li>
        <li><span>✓</span>unprüfbare Wörter und vorschnelle Technikvorgaben erkennen</li>
        <li><span>✓</span>offene Fragen bewusst dokumentieren</li>
      </ul>
    </section>
    <button type="button" class="restart-large" id="restartLargeButton">Mit einem neuen Vorschlag wiederholen</button>`;
}

function wireCurrentScreen() {
  if (state.step === 0) wireBrief();
  if (state.step === 1) wireMirror();
  if (state.step === 2) wireKnowledge();
  if (state.step === 3) wireTypes();
  if (state.step === 4) wireTraps();
  if (state.step === 5) wireSpecification();
  if (state.step === 6) document.querySelector("#restartLargeButton")?.addEventListener("click", restart);
}

function wireBrief() {
  const input = document.querySelector("#proposalInput");
  const count = document.querySelector("#characterCount");
  input.addEventListener("input", () => {
    state.proposal = input.value;
    count.textContent = input.value.length;
    updateActions();
  });
  input.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && input.value.trim().length >= 12) advance();
  });
  document.querySelectorAll("[data-proposal]").forEach((button) => button.addEventListener("click", () => {
    state.proposal = button.dataset.proposal;
    input.value = state.proposal;
    count.textContent = state.proposal.length;
    input.focus();
    updateActions();
  }));
}

function wireMirror() {
  document.querySelectorAll("[data-assumption]").forEach((button) => button.addEventListener("click", () => {
    state.assumptionDecisions[button.dataset.assumption] = button.dataset.value;
    render();
    announce("Annahme wurde eingeordnet.");
  }));
}

function wireKnowledge() {
  document.querySelectorAll("[data-context]").forEach((button) => button.addEventListener("click", () => {
    state.context[button.dataset.context] = button.dataset.value;
    render();
  }));
  document.querySelectorAll("[data-context-multi]").forEach((button) => button.addEventListener("click", () => {
    const values = state.context[button.dataset.contextMulti];
    state.context[button.dataset.contextMulti] = values.includes(button.dataset.value)
      ? values.filter((value) => value !== button.dataset.value)
      : [...values, button.dataset.value];
    render();
  }));
  document.querySelectorAll("[data-method-expand]").forEach((button) => button.addEventListener("click", () => {
    state.expandedMethod = state.expandedMethod === button.dataset.methodExpand ? "" : button.dataset.methodExpand;
    render();
  }));
  document.querySelectorAll("[data-method-select]").forEach((button) => button.addEventListener("click", () => {
    state.selectedMethod = button.dataset.methodSelect;
    render();
    announce("Primäres Verfahren ausgewählt.");
  }));
}

function wireTypes() {
  document.querySelectorAll("[data-classification]").forEach((button) => button.addEventListener("click", () => {
    state.classificationAnswers[button.dataset.classification] = button.dataset.value;
    render();
  }));
}

function wireTraps() {
  document.querySelectorAll("[data-trap]").forEach((button) => button.addEventListener("click", () => {
    state.trapAnswers[button.dataset.trap] = button.dataset.value;
    render();
  }));
}

function wireSpecification() {
  document.querySelector("#copySpecButton")?.addEventListener("click", async () => {
    const text = specificationAsText(engine.buildSpecification(state));
    try {
      await navigator.clipboard.writeText(text);
      state.copied = true;
      render();
      announce("Anforderungspaket wurde kopiert.");
    } catch {
      announce("Kopieren wurde vom Browser nicht erlaubt.");
    }
  });
}

function specificationAsText(spec) {
  const groups = [
    ["Ziel", [spec.goal]], ["Funktionale Anforderungen", spec.functional],
    ["Nicht-funktionale Anforderungen", spec.nfr], ["Randbedingungen", spec.constraints],
    ["Fachliche Regeln", spec.rules], ["Akzeptanzkriterien", spec.acceptance], ["Offene Fragen", spec.open]
  ];
  return groups.map(([title, items]) => `${title}\n${items.map((item) => `- ${item}`).join("\n")}`).join("\n\n");
}

function updateActions() {
  backButton.hidden = state.step === 0;
  nextButton.hidden = state.step === STEPS.length - 1;
  const validations = [
    { ok: state.proposal.trim().length >= 12, hint: "Schreibe mindestens einen kurzen Satz.", label: "Von der KI spiegeln lassen" },
    { ok: true, hint: "Annahmen dürfen bewusst offenbleiben.", label: "Fachwissen aufbauen" },
    { ok: Boolean(state.selectedMethod), hint: "Wähle ein primäres Verfahren – du kannst es später ändern.", label: "Anforderungsarten üben" },
    { ok: Object.keys(state.classificationAnswers).length === engine.CLASSIFICATION_CARDS.length, hint: "Ordne alle sechs Aussagen ein.", label: "Fallen prüfen" },
    { ok: Object.keys(state.trapAnswers).length === engine.TRAPS.length, hint: "Bearbeite alle drei Fälle.", label: "Spezifikation erzeugen" },
    { ok: true, hint: "Prüfe besonders die offen gebliebenen Fragen.", label: "Lernprojekt abschließen" }
  ];
  const validation = validations[state.step];
  if (validation) {
    nextButton.disabled = !validation.ok;
    nextButton.textContent = validation.label;
    actionHint.textContent = validation.ok ? "" : validation.hint;
  } else {
    actionHint.textContent = "";
  }
}

function advance() {
  if (nextButton.disabled || state.step >= STEPS.length - 1) return;
  if (state.step === 0) state.analysis = engine.analyseProposal(state.proposal);
  state.step += 1;
  render();
  document.querySelector("#lessonContent").focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
  announce(`${STEPS[state.step].label} geöffnet.`);
}

function goBack() {
  if (state.step === 0) return;
  state.step -= 1;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function announce(message) {
  liveRegion.textContent = "";
  window.setTimeout(() => { liveRegion.textContent = message; }, 10);
}

function restart(event) {
  event?.preventDefault();
  const shouldRestart = state.step === 0 || window.confirm("Möchtest du deinen aktuellen Lernstand wirklich verwerfen?");
  if (!shouldRestart) return;
  state = initialState();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

nextButton.addEventListener("click", advance);
backButton.addEventListener("click", goBack);
restartButton.addEventListener("click", restart);
document.querySelector(".brand").addEventListener("click", restart);
render();
