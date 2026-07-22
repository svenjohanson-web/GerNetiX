async function loadPublicCommunity() {
  const target = document.querySelector("#publicCommunityQuestions");
  const selectedTag = new URLSearchParams(window.location.search).get("tag") || "";
  try {
    const response = await fetch(`/api/public/community/questions${selectedTag ? `?tag=${encodeURIComponent(selectedTag)}` : ""}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || "Die Community ist gerade nicht erreichbar.");
    const items = payload.items || [];
    renderCategories(items, selectedTag);
    target.innerHTML = items.length ? items.map((question) => `<a class="learning-path-card" href="/community/questions/${encodeURIComponent(question.question_id)}/"><span>${escapeText((question.tags || []).join(" · ") || question.status || "offen")} · ${Number(question.answer_count || 0)} Antworten</span><h3>${escapeText(question.title)}</h3><p>${escapeText(question.body)}</p><strong>Öffentliche Diskussion öffnen →</strong></a>`).join("") : `<p class="lead">Noch keine öffentlichen Anfragen in dieser Kategorie.</p>`;
  } catch (error) { target.innerHTML = `<p class="lead">${escapeText(error.message)}</p>`; }
}
function renderCategories(items, selectedTag) {
  const target = document.querySelector("#publicCommunityCategories");
  const categories = ["hardware", "firmware", "software", "project", "learning", ...items.flatMap((question) => question.tags || [])];
  const uniqueCategories = [...new Set(categories)].sort();
  target.innerHTML = [`<a href="/community/" class="${selectedTag ? "" : "active"}">Alle Themen</a>`, ...uniqueCategories.map((tag) => `<a href="/community/?tag=${encodeURIComponent(tag)}" class="${tag === selectedTag ? "active" : ""}">${escapeText(categoryLabel(tag))}</a>`)].join("");
}
function categoryLabel(tag) { return ({ hardware: "Hardware & Elektronik", firmware: "Firmware & ESP32", software: "Software & Apps", project: "Projektentwicklung", learning: "Lernen & Einstieg" })[tag] || tag; }
function escapeText(value) { const node = document.createElement("span"); node.textContent = String(value || ""); return node.innerHTML; }
loadPublicCommunity();
