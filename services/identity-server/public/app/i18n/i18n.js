(() => {
  const SUPPORTED_LOCALES = ["de", "en", "nl"];
  const COOKIE_NAME = "gernetix_locale";
  const DEFAULT_LOCALE = "de";

  function normalizeLocale(value, fallback = "") {
    const locale = String(value || "").trim().toLowerCase().split(/[-_]/)[0];
    return SUPPORTED_LOCALES.includes(locale) ? locale : fallback;
  }

  function queryLocale() {
    return normalizeLocale(new URLSearchParams(window.location.search).get("lang"));
  }

  function cookieLocale() {
    const entry = document.cookie
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${COOKIE_NAME}=`));
    return normalizeLocale(entry ? decodeURIComponent(entry.slice(COOKIE_NAME.length + 1)) : "");
  }

  function hostnameLocale() {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname === "gernetix.nl" || hostname.endsWith(".gernetix.nl")) return "nl";
    if (hostname === "gernetix.de" || hostname.endsWith(".gernetix.de")) return "de";
    if (hostname === "gernetix.com" || hostname.endsWith(".gernetix.com")) return "en";
    return "";
  }

  function browserLocale() {
    for (const candidate of navigator.languages || [navigator.language]) {
      const locale = normalizeLocale(candidate);
      if (locale) return locale;
    }
    return "";
  }

  function resolveLocale({ accountLocale = "" } = {}) {
    return queryLocale()
      || normalizeLocale(accountLocale)
      || cookieLocale()
      || hostnameLocale()
      || browserLocale()
      || DEFAULT_LOCALE;
  }

  function persistLocale(locale) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  }

  function interpolate(message, variables) {
    return String(message).replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) =>
      Object.hasOwn(variables, key) ? String(variables[key]) : `{${key}}`);
  }

  async function create(options = {}) {
    const basePath = String(options.basePath || "/app/i18n/locales").replace(/\/$/, "");
    const cache = new Map();
    let locale = resolveLocale(options);
    let messages = await loadMessages(locale);

    async function loadMessages(nextLocale) {
      if (cache.has(nextLocale)) return cache.get(nextLocale);
      const response = await fetch(`${basePath}/${nextLocale}.json`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Übersetzungskatalog ${nextLocale} konnte nicht geladen werden.`);
      const catalog = await response.json();
      cache.set(nextLocale, catalog);
      return catalog;
    }

    function t(key, variables = {}, fallback = key) {
      return interpolate(messages[key] ?? fallback, variables);
    }

    function translateDocument(root = document) {
      root.querySelectorAll("[data-i18n]").forEach((element) => {
        element.textContent = t(element.dataset.i18n, {}, element.textContent);
      });
      for (const [selector, attribute, dataKey] of [
        ["[data-i18n-aria-label]", "aria-label", "i18nAriaLabel"],
        ["[data-i18n-placeholder]", "placeholder", "i18nPlaceholder"],
        ["[data-i18n-title]", "title", "i18nTitle"],
      ]) {
        root.querySelectorAll(selector).forEach((element) => {
          element.setAttribute(attribute, t(element.dataset[dataKey], {}, element.getAttribute(attribute) || ""));
        });
      }
      document.documentElement.lang = locale;
    }

    async function setLocale(value, { persist = true } = {}) {
      const nextLocale = normalizeLocale(value);
      if (!nextLocale) throw new Error("Nicht unterstützte Sprache.");
      messages = await loadMessages(nextLocale);
      locale = nextLocale;
      if (persist) persistLocale(locale);
      translateDocument();
      window.dispatchEvent(new CustomEvent("gernetix:localechange", { detail: { locale } }));
      return locale;
    }

    if (queryLocale()) persistLocale(locale);
    document.documentElement.lang = locale;

    return {
      get locale() { return locale; },
      supportedLocales: [...SUPPORTED_LOCALES],
      t,
      translateDocument,
      setLocale,
      formatDate(value, formatOptions = {}) {
        return new Intl.DateTimeFormat(locale, formatOptions).format(new Date(value));
      },
      formatNumber(value, formatOptions = {}) {
        return new Intl.NumberFormat(locale, formatOptions).format(value);
      },
    };
  }

  window.GerNetiXI18n = {
    create,
    normalizeLocale,
    resolveLocale,
    supportedLocales: [...SUPPORTED_LOCALES],
  };
})();
