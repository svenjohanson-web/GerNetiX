(() => {
  const catalogs = new Map();

  async function request(url, options = {}) {
    const response = await fetch(url, { credentials: "same-origin", ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Quizdaten nicht verfügbar");
    return payload;
  }

  async function getCatalog(locale = "de") {
    const selectedLocale = ["de", "en", "nl"].includes(locale) ? locale : "de";
    if (!catalogs.has(selectedLocale)) {
      catalogs.set(selectedLocale, request(`/api/platform/quiz/catalog?locale=${encodeURIComponent(selectedLocale)}`));
    }
    return catalogs.get(selectedLocale);
  }

  function evaluate(locale, categoryId, questionId, optionIndex) {
    return request("/api/platform/quiz/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ locale, category_id: categoryId, question_id: questionId, option_index: optionIndex }),
    });
  }

  window.GerNetiXQuizData = { getCatalog, evaluate };
})();

/*
 * Diese Datei veroeffentlicht ihre Schnittstelle nach UMD-Art durch Zuweisung
 * an das globale Objekt. Es gibt keine gleichnamige Bindung, also wird sie hier
 * angelegt: derselbe Wert, nur ansprechbar fuer den export.
 */
const GerNetiXQuizData = globalThis.GerNetiXQuizData;

export {
  GerNetiXQuizData,
};
