// GerNetiX platform module extracted from app.js.
function renderBilling() {
  const target = document.querySelector("#billingSummary");
  const packages = state.billing.ai_credit_packages || [];
  target.innerHTML = [
    ["Plan", state.billing.plan],
    ["Entitlements", state.billing.entitlements.join(", ")],
    ["Monatliche KI-Credits", state.billing.ai_credits.monthly_available_credits ?? 0],
    ["Gekaufte KI-Credits", state.billing.ai_credits.purchased_available_credits ?? 0],
    ["Verbrauchte Credits", state.billing.ai_credits.consumed_credits ?? 0],
  ].map(summaryItem).join("") + `<article class="summary-item ai-credit-purchase-card"><span>KI-Guthaben</span><strong>Mehr KI-Credits kaufen</strong><small>Gekaufte Credits verfallen nicht.</small><div class="ai-credit-package-list">${packages.map(renderAiCreditPackage).join("")}</div><button class="primary" type="button" data-buy-ai-credits>KI-Credits kaufen</button></article>`;
  target.querySelector("[data-buy-ai-credits]")?.addEventListener("click", () => openAiCreditPurchaseDialog());
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
