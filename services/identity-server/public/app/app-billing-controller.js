// GerNetiX platform module extracted from app.js.
import { escapeAttribute, escapeHtml, putJson, summaryItem } from "@app/app-runtime-utils.js";
import { refresh, renderAll } from "@app/app-shell-controller.js";
import { navigate } from "@app/platform-routing.js";
import { state } from "@app/platform-state.js";

function renderBilling() {
  const target = document.querySelector("#billingSummary");
  const packages = state.billing.ai_credit_packages || [];
  const resources = state.billing.resources || {};
  const usage = resources.usage || {};
  const policy = resources.policy || {};
  target.innerHTML = [
    ["Plan", state.billing.plan],
    ["Policy-Version", policy.policy_version ? `v${policy.policy_version}` : "nicht verfügbar"],
    ["Projekte", formatQuota(usage.projects, policy.max_projects)],
    ["Davon gesperrt", usage.locked_projects ?? "–"],
    ["Projekt-/Git-Speicher", formatByteQuota(usage.storage_bytes, policy.max_storage_bytes)],
    ["Messgrundlage", resources.measurement_source === "sql_source_cache" ? "Projektdateien (Übergangsmessung)" : (resources.measurement_source || "nicht verfügbar")],
    ["Plangültig bis", state.billing.plan_valid_until ? new Date(state.billing.plan_valid_until).toLocaleString("de-DE") : "unbefristet"],
    ["Kontostatus", state.billing.lifecycle_state || "active"],
    ["Entitlements", state.billing.entitlements.join(", ")],
    ["Monatliche KI-Credits", state.billing.ai_credits.monthly_available_credits ?? 0],
    ["Gekaufte KI-Credits", state.billing.ai_credits.purchased_available_credits ?? 0],
    ["Verbrauchte Credits", state.billing.ai_credits.consumed_credits ?? 0],
  ].map(summaryItem).join("")
    + renderStorageQuotaStatus(resources)
    + renderProjectSelection(policy)
    + `<article class="summary-item ai-credit-purchase-card"><span>KI-Guthaben</span><strong>Mehr KI-Credits kaufen</strong><small>Gekaufte Credits verfallen nicht.</small><div class="ai-credit-package-list">${packages.map(renderAiCreditPackage).join("")}</div><button class="primary" type="button" data-buy-ai-credits>KI-Credits kaufen</button></article>`
    + `<article class="summary-item plan-comparison-card"><span>Konten &amp; Tarife</span><strong>Vorteile der Cloud-Stufen vergleichen</strong><small>Kostenlos, Basic+, Premium, KI-Credits und Home-Lizenz verständlich voneinander trennen.</small><a class="button-link" href="/tarife/">Tarifübersicht öffnen</a></article>`;
  target.querySelector("[data-buy-ai-credits]")?.addEventListener("click", () => openAiCreditPurchaseDialog());
  target.querySelector("[data-storage-projects]")?.addEventListener("click", () => navigate("/app/development-platform/"));
  target.querySelector("[data-save-project-selection]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const activeProjectIds = [...target.querySelectorAll("[data-project-selection]:checked")].map((input) => input.value);
    button.disabled = true;
    try {
      await putJson("/api/platform/billing/project-selection", { active_project_ids: activeProjectIds });
      await refresh();
      renderAll();
    } catch (error) {
      const status = target.querySelector("[data-project-selection-status]");
      if (status) status.textContent = error.message || "Die Projektauswahl konnte nicht gespeichert werden.";
      button.disabled = false;
    }
  });
}

function renderStorageQuotaStatus(resources) {
  const usage = resources.usage || {};
  const policy = resources.policy || {};
  const used = Math.max(0, Number(usage.storage_bytes || 0));
  const limit = policy.max_storage_bytes;
  if (limit === null || limit === undefined) {
    return `<article class="summary-item storage-quota-card is-unlimited"><span>Speicherstatus</span><strong>Unbegrenzt</strong><small>Aktuell belegt: ${escapeHtml(formatBytes(used))}. Für diesen Plan ist keine feste Speicherobergrenze gesetzt.</small></article>`;
  }
  const normalizedLimit = Math.max(1, Number(limit));
  const percent = (used / normalizedLimit) * 100;
  const threshold = Math.max(1, Math.min(100, Number(policy.storage_warning_threshold_percent || 80)));
  const overQuota = Boolean(resources.over_quota?.storage) || used > normalizedLimit;
  const atLimit = used >= normalizedLimit;
  const warning = !atLimit && percent >= threshold;
  const stateClass = overQuota || atLimit ? "is-over" : (warning ? "is-warning" : "is-ok");
  const title = overQuota ? "Kontingent überschritten" : (atLimit ? "Speicherlimit erreicht" : (warning ? "Speicher wird knapp" : "Speicher im grünen Bereich"));
  const remaining = Math.max(0, normalizedLimit - used);
  const consequence = overQuota || atLimit
    ? "Weiteres dauerhaftes Wachstum ist gesperrt. Lesen, Exportieren und Löschen bleiben möglich."
    : `Noch ${formatBytes(remaining)} verfügbar. Die Warnschwelle liegt bei ${formatMetric(threshold)} %.`;
  const remedy = overQuota || atLimit || warning
    ? "Du kannst nicht mehr benötigte Projekte oder Projektdateien löschen. Sobald Speicheroptionen angeboten werden, kannst du außerdem Reduktionsregeln wählen oder dein Kontingent erweitern."
    : "Bei wachsendem Bedarf kannst du später Speicherregeln anpassen oder dein Kontingent erweitern.";
  return `<article class="summary-item storage-quota-card ${stateClass}"><span>Speicherstatus</span><strong>${escapeHtml(title)} · ${escapeHtml(formatMetric(percent))} %</strong>${usageBar(percent)}<small>${escapeHtml(consequence)}</small><small>${escapeHtml(remedy)}</small><button type="button" data-storage-projects>Projekte verwalten</button></article>`;
}

function renderProjectSelection(policy) {
  if (!state.projects?.length || policy.max_projects === null || policy.max_projects === undefined) return "";
  const accountProjects = state.projects.filter((project) => project.status !== "catalog_template");
  if (!accountProjects.some((project) => project.status === "plan_locked") && accountProjects.length <= policy.max_projects) return "";
  return `<article class="summary-item project-plan-selection"><span>Verwendbare Projekte auswählen</span><strong>Maximal ${formatNumber(policy.max_projects)} aktiv</strong><small>Gesperrte Projekte bleiben lesbar und können gelöscht werden.</small><div>${accountProjects.map((project) => `<label><input type="checkbox" data-project-selection value="${escapeAttribute(project.id)}" ${project.status === "active" ? "checked" : ""}> ${escapeHtml(project.name)}</label>`).join("")}</div><button type="button" data-save-project-selection>Auswahl speichern</button><small data-project-selection-status></small></article>`;
}

function formatQuota(used, limit) {
  if (used === undefined || used === null) return "nicht verfügbar";
  return `${formatNumber(used)} / ${limit === null ? "unbegrenzt" : formatNumber(limit)}`;
}

function formatByteQuota(used, limit) {
  if (used === undefined || used === null) return "nicht verfügbar";
  return `${formatBytes(used)} / ${limit === null ? "unbegrenzt" : formatBytes(limit)}`;
}

function formatBytes(value) {
  const bytes = Math.max(0, Number(value || 0));
  if (bytes < 1024) return `${bytes.toLocaleString("de-DE")} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let amount = bytes / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && amount >= 1024; index += 1) {
    amount /= 1024;
    unit = units[index];
  }
  return `${amount.toLocaleString("de-DE", { maximumFractionDigits: 1 })} ${unit}`;
}

function renderAiCreditPackage(item) {
  const price = new Intl.NumberFormat("de-DE", { style: "currency", currency: item.currency || "EUR" }).format(Number(item.price_cents || 0) / 100);
  return `<span><strong>${escapeHtml(price)}</strong> · ${formatNumber(item.credits)} Credits · kein Verfall</span>`;
}

function openAiCreditPurchaseDialog(detail = {}) {
  document.querySelector("#aiCreditPurchaseDialog")?.remove();
  const estimate = Number(detail.usagePreflight?.estimated_credits || 0);
  const remaining = Number(detail.usagePreflight?.remaining_credits_after_estimate || 0);
  const overlay = document.createElement("div");
  overlay.id = "aiCreditPurchaseDialog";
  overlay.className = "runtime-modal ai-credit-purchase-modal";
  overlay.innerHTML = `
    <section class="runtime-dialog ai-credit-purchase-dialog" role="dialog" aria-modal="true" aria-labelledby="aiCreditPurchaseTitle">
      <div class="runtime-dialog-header">
        <div><p class="eyebrow">KI-Guthaben</p><h2 id="aiCreditPurchaseTitle">Bitte Tokens kaufen</h2></div>
        <button type="button" data-close-ai-credit-purchase aria-label="Dialog schließen">Schließen</button>
      </div>
      <p>Für diese KI-Anfrage sind nicht genügend KI-Credits verfügbar${estimate ? ` (geschätzt: ${formatNumber(estimate)} Credits)` : ""}. Jede registrierte Person kann zusätzliches Guthaben kaufen – unabhängig vom Kontotyp. Gekaufte Credits verfallen nicht.</p>
      ${remaining < 0 ? `<p class="helper-text">Es fehlen voraussichtlich ${formatNumber(Math.abs(remaining))} Credits.</p>` : ""}
      <section class="ai-credit-purchase-packages" aria-label="KI-Credit-Pakete"><h3>Pakete</h3>${(state.billing?.ai_credit_packages || []).map(renderAiCreditPackage).join("")}</section>
      <ol class="ai-credit-purchase-steps"><li>Im Billing ein KI-Credit-Paket auswählen.</li><li>Die Zahlung beim vorgesehenen Zahlungsanbieter bestätigen.</li><li>Nach der Zahlungsbestätigung wird das Guthaben automatisch deinem Konto gutgeschrieben.</li></ol>
      <div class="button-row"><button class="primary" type="button" data-open-ai-credit-billing>Zu KI-Credits</button><button type="button" data-close-ai-credit-purchase>Später</button></div>
    </section>`;
  const close = () => overlay.remove();
  overlay.querySelectorAll("[data-close-ai-credit-purchase]").forEach((button) => button.addEventListener("click", close));
  overlay.querySelector("[data-open-ai-credit-billing]")?.addEventListener("click", () => { close(); navigate("/app/billing/"); });
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  document.body.append(overlay);
  overlay.querySelector("[data-open-ai-credit-billing]")?.focus();
}

window.addEventListener("ai-credit-purchase-required", (event) => openAiCreditPurchaseDialog(event.detail || {}));

function renderAiRating(selector, compact = false) {
  const target = document.querySelector(selector);
  if (!target) return;
  const rating = state.aiUsage?.rating || {};
  const sources = rating.sources || [];
  if (!sources.length) {
    target.innerHTML = compact
      ? `<p class="helper-text">KI-Nutzung nicht verfuegbar.</p>`
      : `<p class="empty">KI-Nutzung nicht verfuegbar.</p>`;
    return;
  }
  const rows = sources.map((source) => {
    const detail = source.unlimited
      ? `${formatNumber(source.month_tokens)} Tokens, unbegrenzt`
      : `${formatNumber(source.month_tokens)} / ${formatNumber(source.token_limit)} Tokens`;
    return `
      <article class="ai-rating-card">
        <span>${escapeHtml(source.title || source.source_id)}</span>
        <strong>${source.unlimited ? "unbegrenzt" : `${formatMetric(source.used_percent)} %`}</strong>
        <small>${escapeHtml(detail)}</small>
        ${source.unlimited ? "" : usageBar(source.used_percent)}
      </article>
    `;
  }).join("");
  target.innerHTML = compact
    ? `<div class="ide-ai-rating-head"><p class="eyebrow">KI Nutzung</p><strong>${formatMetric(rating.used_percent || 0)} % verbraucht</strong></div><div class="ai-rating-grid compact">${rows}</div>`
    : rows;
}

function usageBar(value) {
  const percent = Math.max(0, Math.min(100, Number(value || 0)));
  return `<span class="usage-bar"><i style="width:${percent}%"></i></span>`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

function formatMetric(value) {
  return Number(value || 0).toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

export {
  formatNumber,
  renderAiRating,
  renderBilling,
};

