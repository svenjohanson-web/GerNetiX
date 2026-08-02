const ProjectFeedbackUI = (() => {
  function open({ subjectType, subjectId, title, kind = "rating" }) {
    document.querySelector("#projectFeedbackDialog")?.remove();
    const rating = kind === "rating";
    const overlay = document.createElement("div");
    overlay.id = "projectFeedbackDialog";
    overlay.className = "runtime-modal project-feedback-modal";
    overlay.innerHTML = `
      <section class="runtime-dialog project-feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="projectFeedbackTitle">
        <header class="runtime-dialog-header"><div><p class="eyebrow">${rating ? "Bewertung" : "Verbesserungsvorschlag"}</p><h2 id="projectFeedbackTitle">${escapeHtml(title || "Projekt")}</h2></div><button type="button" data-close-project-feedback>Schließen</button></header>
        <form data-project-feedback-form>
          ${rating ? `<p class="helper-text">Bewerte die Vorlage bzw. das Projekt von 1 bis 5.</p><div class="learning-rating-grid">${ratingScale("clarity", "Verständlichkeit")}${ratingScale("fun", "Spaß")}${ratingScale("difficulty", "Schwierigkeit")}${ratingScale("completeness", "Vollständigkeit")}</div>` : `<p class="helper-text">Beschreibe möglichst konkret, was verbessert oder ergänzt werden sollte.</p>`}
          <label class="learning-rating-comment">${rating ? "Kommentar (optional)" : "Verbesserungsvorschlag"}<textarea name="message" rows="4" maxlength="2000" ${rating ? "" : "required"} placeholder="Was können wir verbessern?"></textarea></label>
          <div class="learning-rating-actions"><button class="primary" type="submit">${rating ? "Bewertung senden" : "Vorschlag senden"}</button><span data-project-feedback-status aria-live="polite"></span></div>
        </form>
      </section>`;
    const close = () => overlay.remove();
    overlay.querySelector("[data-close-project-feedback]").addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const status = form.querySelector("[data-project-feedback-status]");
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      status.textContent = "Wird gesendet …";
      try {
        await postJson(subjectType === "template" ? "/api/platform/template-feedback" : "/api/platform/project-feedback", {
          kind,
          message: String(data.get("message") || ""),
          ...(rating ? { ratings: Object.fromEntries(["clarity", "fun", "difficulty", "completeness"].map((key) => [key, Number(data.get(key))])) } : {}),
          ...(subjectType === "template" ? { templateId: subjectId } : { projectId: subjectId }),
        });
        status.textContent = "Danke – deine Rückmeldung wurde gespeichert.";
        form.querySelectorAll("input, textarea").forEach((field) => { field.disabled = true; });
        button.remove();
      } catch (error) {
        status.textContent = error?.message || "Die Rückmeldung konnte nicht gespeichert werden.";
        button.disabled = false;
      }
    });
    document.body.append(overlay);
    overlay.querySelector("input, textarea")?.focus();
  }

  function ratingScale(name, label) {
    return `<fieldset class="learning-rating-scale"><legend>${label}</legend><div class="learning-rating-options">${[1, 2, 3, 4, 5].map((value) => `<label><input type="radio" name="${name}" value="${value}" required><span>${value}</span></label>`).join("")}</div></fieldset>`;
  }

  return { open };
})();
