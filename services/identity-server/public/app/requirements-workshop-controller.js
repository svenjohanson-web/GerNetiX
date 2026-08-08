"use strict";

const GerNetiXRequirementsWorkshop = (() => {
  const workshopState = { bound: false, busy: false, messages: [], feedback: null };
  const examples = {
    login: "Der Nutzer meldet sich sicher an und darf danach die Anwendung verwenden.",
    fast: "Die Zugangsprüfung muss schnell sein. Bei einem Fehler soll das System sinnvoll reagieren.",
    roles: "Berechtigte Personen dürfen den Technikraum betreten. Unberechtigte Personen dürfen nicht hinein.",
  };

  function bind() {
    if (workshopState.bound) return;
    workshopState.bound = true;
    document.querySelector("#requirementsWorkshopForm")?.addEventListener("submit", submit);
    document.querySelectorAll("[data-workshop-example]").forEach((button) => button.addEventListener("click", () => {
      const input = document.querySelector("#requirementsWorkshopInput");
      if (!input) return;
      input.value = examples[button.dataset.workshopExample] || "";
      input.focus();
      window.GerNetiXAiChatPattern?.resize?.(input);
    }));
  }

  function enter() {
    bind();
    render();
  }

  async function submit(event) {
    event.preventDefault();
    const input = document.querySelector("#requirementsWorkshopInput");
    const proposal = input?.value.trim();
    if (!proposal || workshopState.busy) return;
    workshopState.busy = true;
    workshopState.messages.push({ role: "user", content: proposal }, { role: "assistant", content: "Ich gleiche Formulierungen, Annahmen und fehlendes Fachwissen ab …", pending: true });
    input.value = "";
    render();
    try {
      const response = await postJson("/api/platform/requirements-workshop/feedback", { proposal });
      workshopState.messages.pop();
      workshopState.messages.push({ role: "assistant", content: response.feedback.summary });
      workshopState.feedback = response.feedback;
    } catch (error) {
      const pending = workshopState.messages.at(-1);
      pending.pending = false;
      pending.error = true;
      pending.content = `${error.message || "Die KI-Auswertung ist fehlgeschlagen."} Dein Text ist nicht verloren; kopiere ihn bei Bedarf in das Offline-Lernprojekt.`;
      input.value = proposal;
    } finally {
      workshopState.busy = false;
      render();
    }
  }

  function render() {
    const root = document.querySelector("#requirementsWorkshopView");
    if (!root) return;
    const messages = document.querySelector("#requirementsWorkshopMessages");
    if (messages) {
      const intro = '<article class="ai-chat__message is-assistant"><strong>Coach</strong><p>Beschreibe eine Anforderung so, wie sie dir gerade in den Kopf kommt. Ich sage dir nicht nur, wie sie besser klingt, sondern was ich daraus tatsächlich ableiten würde.</p></article>';
      messages.innerHTML = intro + workshopState.messages.map((message) => `<article class="ai-chat__message ${message.role === "user" ? "is-user" : "is-assistant"} ${message.pending ? "is-pending" : ""} ${message.error ? "is-error" : ""}"><strong>${message.role === "user" ? "Du" : "Coach"}</strong><p>${escapeHtml(message.content)}${message.pending ? '<small class="ai-chat__status">KI verarbeitet den Vorschlag …</small>' : message.error ? '<small class="ai-chat__status">Du kannst den Vorschlag erneut prüfen.</small>' : ""}</p></article>`).join("");
      messages.scrollTop = messages.scrollHeight;
    }
    const connection = document.querySelector("#requirementsWorkshopConnection");
    if (connection) {
      connection.textContent = workshopState.busy ? "KI arbeitet …" : "Bereit";
      connection.classList.toggle("is-busy", workshopState.busy);
    }
    document.querySelector("#requirementsWorkshopInput")?.toggleAttribute("disabled", workshopState.busy);
    document.querySelector("#requirementsWorkshopSend")?.toggleAttribute("disabled", workshopState.busy);
    renderFeedback(workshopState.feedback);
  }

  function renderFeedback(feedback) {
    if (!feedback) return;
    document.querySelector("#requirementsWorkshopMirror h2").textContent = "So hat die KI dich verstanden";
    document.querySelector("#requirementsWorkshopScore").textContent = `${feedback.quality_score} %`;
    document.querySelector("#requirementsWorkshopSummary").textContent = feedback.summary;
    const result = document.querySelector("#requirementsWorkshopResults");
    if (!result) return;
    result.innerHTML = [
      section("Sicher verstanden", feedback.understood, "understood"),
      assumptionSection(feedback.assumptions),
      section("Unklar oder mehrdeutig", feedback.unclear, "unclear"),
      knowledgeSection(feedback.knowledge_gaps),
      section("Funktionale Anforderungen", feedback.functional_requirements, "functional"),
      section("Nichtfunktionale Anforderungen", feedback.non_functional_requirements, "quality"),
      section("Randbedingungen", feedback.constraints, "constraints"),
      section("Geschäftsregeln", feedback.business_rules, "rules"),
      section("Testbare Akzeptanzkriterien", feedback.acceptance_criteria, "criteria"),
      section("Die nächsten Rückfragen", feedback.follow_up_questions, "questions"),
    ].join("");
  }

  function section(title, items, kind) {
    if (!items?.length) return "";
    return `<section class="requirements-workshop-result is-${kind}"><h3>${escapeHtml(title)}</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>`;
  }

  function assumptionSection(items) {
    if (!items?.length) return "";
    return `<section class="requirements-workshop-result is-assumptions"><h3>Annahmen, die die KI sonst treffen müsste</h3>${items.map((item) => `<article><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p><small>Auswirkung: ${escapeHtml(item.impact)}</small></article>`).join("")}</section>`;
  }

  function knowledgeSection(items) {
    if (!items?.length) return "";
    return `<section class="requirements-workshop-result is-knowledge"><h3>Fachwissen, das noch gebraucht wird</h3>${items.map((item) => `<article><strong>${escapeHtml(item.topic)}</strong><p>${escapeHtml(item.explanation)}</p>${item.options?.length ? `<small>Mögliche Richtungen: ${item.options.map(escapeHtml).join(" · ")}</small>` : ""}</article>`).join("")}</section>`;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  }

  return { bind, enter, render };
})();
