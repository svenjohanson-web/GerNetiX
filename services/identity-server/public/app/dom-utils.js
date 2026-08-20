const DomUtils = (() => {
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll('"', "&quot;");
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function meta(label, value) {
    return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
  }

  function summaryItem([label, value]) {
    return `<article class="summary-item"><p class="eyebrow">${escapeHtml(label)}</p><strong>${escapeHtml(value)}</strong></article>`;
  }

  return {
    delay,
    escapeAttribute,
    escapeHtml,
    meta,
    summaryItem,
  };
})();

/*
 * Uebergangsbruecke.
 *
 * Diese Datei ist ein ES-Modul, ihre Namen sind damit nicht mehr global. Die
 * Dateien, die DomUtils heute benutzen, sind aber noch klassische Skripte und
 * lesen den Namen global. Bis sie ihn einfuehren, wird er hier ausdruecklich
 * bereitgestellt.
 *
 * DomUtils ist ein unveraenderliches Namensraum-Objekt und wird nie neu
 * zugewiesen, deshalb genuegt eine einfache Zuweisung. Bei veraenderlichen
 * Werten waeren Zugriffsmethoden noetig, sonst liefe die Zuweisung eines
 * klassischen Skripts am Modul vorbei.
 */
export { DomUtils };
globalThis.DomUtils = DomUtils;
