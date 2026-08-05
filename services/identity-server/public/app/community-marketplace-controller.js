let communityMarketplaceEventsBound = false;

function bindCommunityMarketplaceEvents() {
  if (communityMarketplaceEventsBound) return;
  communityMarketplaceEventsBound = true;
  document.querySelector("#refreshCommunityMarketplaceButton")?.addEventListener("click", () => loadCommunityMarketplace(true));
  document.querySelector("#communityMarketplaceForm")?.addEventListener("submit", submitCommunityMarketplaceListing);
  document.querySelector("#communityMarketplaceListings")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-marketplace-listing]");
    if (button) openCommunityMarketplaceListing(button.dataset.marketplaceListing);
  });
}

async function loadCommunityMarketplace(force = false) {
  if (state.marketplace.loading || (state.marketplace.loaded && !force)) return;
  state.marketplace.loading = true;
  renderCommunityMarketplace();
  try {
    const result = await getJson("/api/community/marketplace/listings");
    state.marketplace.items = result.items || [];
    state.marketplace.error = "";
    state.marketplace.loaded = true;
  } catch (error) {
    state.marketplace.items = [];
    state.marketplace.error = error.message || "Der Community-Marktplatz ist nicht erreichbar.";
  } finally {
    state.marketplace.loading = false;
    renderCommunityMarketplace();
  }
}

function renderCommunityMarketplace() {
  const target = document.querySelector("#communityMarketplaceListings");
  if (!target) return;
  const items = state.marketplace.items || [];
  target.innerHTML = state.marketplace.loading
    ? `<p class="helper-text">Inserate werden geladen …</p>`
    : items.length ? items.map((item) => `<article class="marketplace-card">
      <header><div><p class="eyebrow">${escapeHtml(marketplaceCategoryLabel(item.category))}</p><h3>${escapeHtml(item.title)}</h3></div><strong class="marketplace-price">${escapeHtml(formatMarketplacePrice(item))}</strong></header>
      <p>${escapeHtml(item.description)}</p>
      <ul class="learning-tag-list">${(item.tags || []).map((tag) => `<li>${escapeHtml(tag)}</li>`).join("")}</ul>
      <dl><div><dt>Zustand</dt><dd>${escapeHtml(marketplaceConditionLabel(item.condition))}</dd></div><div><dt>Übergabe</dt><dd>${escapeHtml(item.shipping_available ? "Versand möglich" : "Abholung")}</dd></div><div><dt>Ort/Region</dt><dd>${escapeHtml(item.pickup_location || "Nach Absprache")}</dd></div></dl>
      <footer><small>Privates Community-Inserat · ungeprüft</small><button type="button" data-marketplace-listing="${escapeAttribute(item.listing_id)}">Inserat ansehen</button></footer>
    </article>`).join("") : `<p class="empty">${escapeHtml(state.marketplace.error || "Noch keine gebrauchte Elektronik angeboten.")}</p>`;
}

async function submitCommunityMarketplaceListing(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const status = document.querySelector("#communityMarketplaceStatus");
  const button = form.querySelector("button[type=submit]");
  const price = Number(String(data.get("price") || "").replace(",", "."));
  if (!Number.isFinite(price) || price < 0) {
    status.textContent = "Bitte gib einen gültigen Preis ein.";
    return;
  }
  button.disabled = true;
  status.textContent = "Inserat wird veröffentlicht …";
  try {
    await postJson("/api/community/marketplace/listings", {
      title: data.get("title"), description: data.get("description"), category: data.get("category"),
      condition: data.get("condition"), price_cents: Math.round(price * 100), pickup_location: data.get("pickup_location"),
      shipping_available: data.get("shipping_available") === "on",
      tags: String(data.get("tags") || "").split(",").map((item) => item.trim()).filter(Boolean),
    });
    form.reset();
    state.marketplace.loaded = false;
    status.textContent = "Dein Elektronik-Inserat wurde veröffentlicht.";
    await loadCommunityMarketplace(true);
  } catch (error) {
    status.textContent = error.message || "Das Inserat konnte nicht veröffentlicht werden.";
  } finally { button.disabled = false; }
}

async function openCommunityMarketplaceListing(listingId) {
  try {
    const item = await getJson(`/api/community/marketplace/listings/${encodeURIComponent(listingId)}`);
    document.querySelector("#communityMarketplaceDetail")?.remove();
    const overlay = document.createElement("div");
    overlay.id = "communityMarketplaceDetail";
    overlay.className = "runtime-modal";
    overlay.innerHTML = `<section class="runtime-dialog marketplace-detail" role="dialog" aria-modal="true"><header class="runtime-dialog-header"><div><p class="eyebrow">Gebrauchte Elektronik</p><h2>${escapeHtml(item.title)}</h2></div><button type="button" data-close-marketplace-detail>Schließen</button></header>
      <p class="marketplace-detail-price">${escapeHtml(formatMarketplacePrice(item))}</p><p>${escapeHtml(item.description)}</p>
      <dl class="marketplace-detail-facts"><div><dt>Zustand</dt><dd>${escapeHtml(marketplaceConditionLabel(item.condition))}</dd></div><div><dt>Kategorie</dt><dd>${escapeHtml(marketplaceCategoryLabel(item.category))}</dd></div><div><dt>Übergabe</dt><dd>${escapeHtml(item.shipping_available ? "Versand möglich" : "Nur Abholung")}</dd></div><div><dt>Ort/Region</dt><dd>${escapeHtml(item.pickup_location || "Nach Absprache")}</dd></div><div><dt>Anbieter</dt><dd>${escapeHtml(item.author_label || "Community-Mitglied")}</dd></div></dl>
      <p class="community-marketplace-warning">Privates Community-Inserat. GerNetiX prüft weder Ware noch Anbieter und wickelt keine Zahlung ab. Teile keine Zahlungs- oder Adressdaten öffentlich.</p>
      <div class="button-row">${item.is_owner ? `<button type="button" data-marketplace-state="sold" data-listing-id="${escapeAttribute(item.listing_id)}">Als verkauft markieren</button>` : `<button class="primary" type="button" data-contact-marketplace="${escapeAttribute(item.author_label || "")}" data-listing-title="${escapeAttribute(item.title)}">Anbieter kontaktieren</button>`}</div>
    </section>`;
    overlay.querySelector("[data-close-marketplace-detail]").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
    overlay.querySelector("[data-contact-marketplace]")?.addEventListener("click", (event) => openMarketplaceContact(event.currentTarget.dataset.contactMarketplace, event.currentTarget.dataset.listingTitle));
    overlay.querySelector("[data-marketplace-state]")?.addEventListener("click", async (event) => {
      await patchJson(`/api/community/marketplace/listings/${encodeURIComponent(event.currentTarget.dataset.listingId)}`, { state: event.currentTarget.dataset.marketplaceState });
      overlay.remove();
      await loadCommunityMarketplace(true);
    });
    document.body.append(overlay);
  } catch (error) { window.alert(error.message || "Das Inserat konnte nicht geladen werden."); }
}

function openMarketplaceContact(recipient, listingTitle) {
  document.querySelector("#communityMarketplaceDetail")?.remove();
  document.querySelector("#communityMarketplaceContact")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "communityMarketplaceContact";
  overlay.className = "runtime-modal";
  overlay.innerHTML = `<section class="runtime-dialog marketplace-contact" role="dialog" aria-modal="true"><header class="runtime-dialog-header"><div><p class="eyebrow">Private Nachricht</p><h2>An ${escapeHtml(recipient)}</h2></div><button type="button" data-close-marketplace-contact>Schließen</button></header><form data-marketplace-contact-form><label>Betreff<input name="subject" required maxlength="160" value="${escapeAttribute(`Interesse an: ${listingTitle}`)}"></label><label>Nachricht<textarea name="body" required maxlength="8000" rows="6">${escapeHtml(`Hallo, ich interessiere mich für dein Inserat „${listingTitle}“. Ist der Artikel noch verfügbar?`)}</textarea></label><div class="button-row"><button class="primary" type="submit">Privat senden</button><span data-marketplace-contact-status aria-live="polite"></span></div></form></section>`;
  const close = () => overlay.remove();
  overlay.querySelector("[data-close-marketplace-contact]").addEventListener("click", close);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  overlay.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const status = form.querySelector("[data-marketplace-contact-status]");
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    status.textContent = "Nachricht wird gesendet …";
    try {
      await postJson("/api/community/message-threads", { recipient_username: recipient, subject: data.get("subject"), body: data.get("body") });
      status.textContent = "Die private Nachricht wurde gesendet.";
      form.querySelectorAll("input, textarea").forEach((field) => { field.disabled = true; });
      button.remove();
    } catch (error) {
      status.textContent = error.message || "Die Nachricht konnte nicht gesendet werden.";
      button.disabled = false;
    }
  });
  document.body.append(overlay);
  overlay.querySelector("textarea")?.focus();
}

function formatMarketplacePrice(item) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: item.currency || "EUR" }).format(Number(item.price_cents || 0) / 100);
}

function marketplaceCategoryLabel(value) {
  return ({ boards: "Boards & Mikrocontroller", sensors: "Sensoren", displays: "Displays", components: "Bauteile", tools: "Werkzeuge", bundles: "Konvolute", other: "Sonstiges" })[value] || "Sonstiges";
}

function marketplaceConditionLabel(value) {
  return ({ like_new: "Wie neu", very_good: "Sehr gut", good: "Gut", acceptable: "Gebraucht", for_parts: "Defekt / Ersatzteile" })[value] || "Nicht angegeben";
}
