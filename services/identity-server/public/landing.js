const menuButton = document.querySelector("#publicMenuButton");
const menu = document.querySelector("#publicMenu");
const publicLoginLink = document.querySelector("#publicLoginLink");
const navigationModel = window.GerNetiXNavigationModel;
let publicI18n = null;

initializePublicTheme();
normalizePublicNavigation();
const publicI18nReady = initializePublicI18n();
initializePublicSession();

function normalizePublicNavigation() {
  if (!menu || !navigationModel) return;
  menu.setAttribute("aria-label", "Öffentliche Bereiche");
  menu.dataset.i18nAriaLabel = "nav.public";
  menu.replaceChildren(...navigationModel.anonymous.map(createNavigationLink));
  document.body.classList.remove("public-session-authenticated");
}

async function initializePublicSession() {
  try {
    const response = await fetch("/api/session", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) return;
    const session = await response.json();
    if (!session.authenticated) return;
    showAuthenticatedPublicNavigation(session.account);
  } catch {
    // Public pages remain usable when the optional session check is unavailable.
  }
}

function showAuthenticatedPublicNavigation(account) {
  if (!menu || !navigationModel) return;
  const authenticated = navigationModel.authenticated;
  const isVisible = (item) => !item.contexts || item.contexts.includes("public");
  const username = String(account?.username || "").trim();
  const [dashboard, ...primary] = authenticated.primary;
  const dashboardLink = createNavigationLink(dashboard);
  if (username) dashboardLink.prepend(document.createTextNode(`${username} · `));

  menu.setAttribute("aria-label", "Plattformbereiche");
  menu.removeAttribute("data-i18n-aria-label");
  menu.replaceChildren(
    dashboardLink,
    ...primary.filter(isVisible).map(createNavigationLink),
    ...authenticated.groups.map((group) => createNavigationGroup(group, isVisible)),
    ...authenticated.fixed.filter(isVisible).map(createNavigationLink),
  );
  if (publicLoginLink) {
    publicLoginLink.href = "/app/dashboard/";
    publicLoginLink.textContent = "Zum Dashboard";
    publicLoginLink.dataset.i18n = "landing.header.dashboard_action";
  }
  publicI18n?.translateDocument();
  document.body.classList.add("public-session-authenticated");
}

function createNavigationGroup(groupDefinition, isVisible) {
  const group = document.createElement("details");
  group.className = "site-menu-group";
  const summary = document.createElement("summary");
  summary.textContent = groupDefinition.label;
  if (groupDefinition.i18n) summary.dataset.i18n = groupDefinition.i18n;
  const content = document.createElement("div");
  const items = groupDefinition.items.filter(isVisible);
  content.append(...items.map(createNavigationLink));
  group.append(summary, content);
  group.open = items.some((item) => navigationPathIsActive(item.href));
  return group;
}

function createNavigationLink(item) {
  const link = document.createElement("a");
  link.href = item.href;
  const copy = document.createElement("span");
  copy.textContent = item.label;
  if (item.i18n) copy.dataset.i18n = item.i18n;
  link.append(copy);
  if (item.logout) link.dataset.publicLogout = "true";
  if (navigationPathIsActive(item.href)) link.setAttribute("aria-current", "page");
  return link;
}

function navigationPathIsActive(href) {
  const currentPath = window.location.pathname;
  if (href === "/") return currentPath === href;
  return currentPath === href || currentPath.startsWith(href);
}

async function initializePublicI18n() {
  try {
    await loadPublicI18nScript();
    addPublicLanguageSwitcher();
    decoratePublicNavigation();
    publicI18n = await window.GerNetiXI18n.create();
    window.GerNetiXPublicI18n = publicI18n;
    publicI18n.translateDocument();
    const languageSelect = document.querySelector("#publicLanguage");
    languageSelect.value = publicI18n.locale;
    languageSelect.disabled = false;
    document.dispatchEvent(new CustomEvent("gernetix:public-i18n-ready", { detail: publicI18n }));
  } catch (error) {
    console.warn("Public translations could not be initialized.", error);
  }
}

function loadPublicI18nScript() {
  if (window.GerNetiXI18n) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/app/i18n/i18n.js?v=20260726-02";
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.append(script);
  });
}

function addPublicLanguageSwitcher() {
  const header = document.querySelector(".site-header");
  if (!header || document.querySelector("#publicLanguage")) return;
  const switcher = document.createElement("label");
  switcher.className = "public-language-switcher";
  switcher.setAttribute("for", "publicLanguage");
  switcher.innerHTML = `
    <span class="public-language-globe" aria-hidden="true">🌐</span>
    <span class="public-language-copy"><span data-i18n="language.label">Sprache</span><small>DE · EN · NL</small></span>
    <select id="publicLanguage" data-i18n-aria-label="language.label" aria-label="Sprache" disabled>
      <option value="de">Deutsch</option>
      <option value="en">English</option>
      <option value="nl">Nederlands</option>
    </select>
  `;
  header.insertBefore(switcher, menuButton);
  switcher.querySelector("select").addEventListener("change", async (event) => {
    const i18n = publicI18n || await publicI18nReady;
    if (i18n) await i18n.setLocale(event.target.value);
  });
}

function initializePublicTheme() {
  const storageKey = "gernetix-public-theme";
  const root = document.documentElement;
  const savedTheme = window.localStorage.getItem(storageKey);
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  let theme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : (prefersDark ? "dark" : "light");

  const applyTheme = (nextTheme) => {
    theme = nextTheme;
    root.dataset.publicTheme = theme;
    document.querySelectorAll("[data-theme-image]").forEach((image) => {
      const nextSource = image.dataset[`theme${theme === "dark" ? "Dark" : "Light"}Src`];
      if (nextSource && image.getAttribute("src") !== nextSource) image.src = nextSource;
    });
    const button = document.querySelector("#publicThemeToggle");
    if (!button) return;
    const nextLabel = theme === "dark" ? "Helles Design einschalten" : "Dunkles Design einschalten";
    button.setAttribute("aria-label", nextLabel);
    button.setAttribute("title", nextLabel);
    button.setAttribute("aria-pressed", String(theme === "dark"));
    button.textContent = theme === "dark" ? "☀" : "◐";
  };

  applyTheme(theme);
  const header = document.querySelector(".site-header");
  if (!header || document.querySelector("#publicThemeToggle")) return;
  const button = document.createElement("button");
  button.id = "publicThemeToggle";
  button.className = "public-theme-toggle";
  button.type = "button";
  button.addEventListener("click", () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(storageKey, nextTheme);
    applyTheme(nextTheme);
  });
  header.insertBefore(button, menuButton);
  applyTheme(theme);
}

function decoratePublicNavigation() {
  if (menuButton) menuButton.dataset.i18nAriaLabel = "menu.open";
  if (!document.body.classList.contains("public-session-authenticated")) {
    menu.dataset.i18nAriaLabel = "nav.public";
  }
}

function tr(key, fallback) {
  return publicI18n ? publicI18n.t(key, {}, fallback) : fallback;
}

function closeMenu() {
  if (!menu || !menuButton) return;
  menu.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", tr("menu.open", "Menü öffnen"));
}

function openMenu() {
  if (!menu || !menuButton) return;
  menu.hidden = false;
  menuButton.setAttribute("aria-expanded", "true");
  menuButton.setAttribute("aria-label", tr("menu.close", "Menü schließen"));
}

menuButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  if (menu.hidden) openMenu();
  else closeMenu();
});

menu?.addEventListener("click", async (event) => {
  event.stopPropagation();
  const logoutLink = event.target.closest("[data-public-logout]");
  if (logoutLink) {
    event.preventDefault();
    closeMenu();
    try {
      const response = await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
      if (response.ok) window.location.assign("/");
    } catch {
      // Keep the authenticated menu visible when logout could not be confirmed.
    }
    return;
  }
  if (event.target.closest("a")) closeMenu();
});

document.addEventListener("click", closeMenu);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});
