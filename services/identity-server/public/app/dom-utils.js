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
