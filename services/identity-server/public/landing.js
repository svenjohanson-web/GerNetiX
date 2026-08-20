const menuButton = document.querySelector("#publicMenuButton");
const menu = document.querySelector("#publicMenu");
const publicLoginLink = document.querySelector("#publicLoginLink");
let publicI18n = null;

initializePublicTheme();
normalizePublicNavigation();
const publicI18nReady = initializePublicI18n();
initializePublicSession();

function normalizePublicNavigation() {
  if (!menu) return;
  const links = [
    ["/", "Startseite"],
    ["/ueber-uns/", "Über uns"],
    ["/nachbauprojekte/nexi-sprachassistent/", "Nexi"],
    ["/nachbauprojekte/", "Projekte zum Nachbauen"],
    ["/technik-labs/", "Virtuelles Elektroniklabor"],
    ["/flashbox-einrichten/", "FlashBox einrichten"],
    ["/wissen/", "Wissensportal"],
    ["/community/", "Community"],
    ["/hilfe/", "Hilfe"],
    ["/support/", "Support"],
    ["/leistungen/", "Leistungen"],
    ["/tarife/", "Konten & Tarife"],
    ["/shop/", "Webshop"],
    ["/app/auth/", "Anmelden"],
  ];
  menu.setAttribute("aria-label", "Öffentliche Bereiche");
  menu.dataset.i18nAriaLabel = "nav.public";
  menu.replaceChildren(...links.map(([href, label]) => createNavigationLink(href, label)));
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
  if (!menu) return;
  const username = String(account?.username || "").trim();
  const dashboardLink = createNavigationLink("/app/dashboard/", "Übersicht", "platform.nav.dashboard");
  if (username) dashboardLink.prepend(document.createTextNode(`${username} · `));
  const logoutLink = createNavigationLink("/app/auth/", "Abmelden", "platform.nav.logout");
  logoutLink.dataset.publicLogout = "true";

  menu.setAttribute("aria-label", "Plattformbereiche");
  menu.removeAttribute("data-i18n-aria-label");
  menu.replaceChildren(
    dashboardLink,
    createNavigationLink("/app/applications/", "Meine Anwendungen", "platform.nav.applications"),
    createNavigationGroup("Lernen & Entwickeln", "platform.menu.learn_develop", [
      ["/app/learn/", "Lernplattform", "platform.nav.learning"],
      ["/app/development-platform/", "Entwicklungsplattform", "platform.nav.development"],
      ["/app/quiz/", "Quiz", "platform.nav.quiz"],
      ["/wissen/", "Wissensspeicher", "platform.nav.knowledge_store"],
      ["/app/community/", "Community", "platform.nav.community"],
      ["/nachbauprojekte/", "Nachbauprojekte", "nav.rebuild_projects"],
    ]),
    createNavigationGroup("Boards & Werkzeuge", "platform.menu.boards_tools", [
      ["/app/device-management/", "Geräte", "platform.nav.devices"],
      ["/app/hardware-lab/", "KI-Hardware-Assistent", "platform.nav.hardware_lab"],
      ["/technik-labs/", "Virtuelles Elektroniklabor"],
      ["/app/downloads/", "Downloads", "platform.nav.downloads"],
      ["/flashbox-einrichten/", "FlashBox einrichten", "nav.usb_helper"],
    ]),
    createNavigationGroup("Service & Shop", "platform.menu.service_shop", [
      ["/app/about/", "Über uns", "footer.about"],
      ["/support/", "Support", "nav.support"],
      ["/leistungen/", "Leistungen", "nav.services"],
      ["/shop/", "Webshop", "nav.shop"],
    ]),
    createNavigationGroup("Konto", "platform.menu.account", [
      ["/app/account-setup/", "Profil", "profile.menu"],
      ["/app/billing/", "Billing", "platform.nav.billing"],
    ]),
    createNavigationLink("/hilfe/", "Hilfe", "nav.help"),
    createNavigationLink("/app/messages/", "Nachrichten"),
    logoutLink,
  );
  if (publicLoginLink) {
    publicLoginLink.href = "/app/dashboard/";
    publicLoginLink.textContent = "Zum Dashboard";
    publicLoginLink.dataset.i18n = "landing.header.dashboard_action";
  }
  publicI18n?.translateDocument();
  document.body.classList.add("public-session-authenticated");
}

function createNavigationGroup(label, i18nKey, links) {
  const group = document.createElement("details");
  group.className = "site-menu-group";
  const summary = document.createElement("summary");
  summary.textContent = label;
  if (i18nKey) summary.dataset.i18n = i18nKey;
  const content = document.createElement("div");
  content.append(...links.map(([href, linkLabel, linkI18nKey]) => createNavigationLink(href, linkLabel, linkI18nKey)));
  group.append(summary, content);
  group.open = links.some(([href]) => navigationPathIsActive(href));
  return group;
}

function createNavigationLink(href, label, i18nKey = "") {
  const link = document.createElement("a");
  link.href = href;
  const copy = document.createElement("span");
  copy.textContent = label;
  if (i18nKey) copy.dataset.i18n = i18nKey;
  link.append(copy);
  if (navigationPathIsActive(href)) link.setAttribute("aria-current", "page");
  return link;
}

function navigationPathIsActive(href) {
  const currentPath = window.location.pathname;
  if (href === "/") return currentPath === href;
  return currentPath === href || currentPath.startsWith(href);
}

async function initializePublicI18n() {
  try {
    const { GerNetiXI18n } = await ladePublicI18nModul();
    addPublicLanguageSwitcher();
    decoratePublicNavigation();
    publicI18n = await GerNetiXI18n.create();
    publicI18n.translateDocument();
    const languageSelect = document.querySelector("#publicLanguage");
    languageSelect.value = publicI18n.locale;
    languageSelect.disabled = false;
    document.dispatchEvent(new CustomEvent("gernetix:public-i18n-ready", { detail: publicI18n }));
  } catch (error) {
    console.warn("Public translations could not be initialized.", error);
  }
}

/*
 * Die Uebersetzung wird erst geholt, wenn sie gebraucht wird.
 *
 * Frueher baute diese Datei dafuer ein Skript-Tag zusammen -- mit einer eigenen,
 * hier eingetragenen Cache-Version. Die wich vom Dokument ab, ohne dass es
 * jemandem auffiel; fuer den Browser sind zwei Adressen zwei Module, i18n.js
 * waere also zweimal ausgewertet worden.
 *
 * import() nimmt die Adresse aus der Import Map der Seite. Damit gibt es nur
 * noch eine Angabe, und sie steht dort, wo sie ohnehin gepflegt wird. Auch ein
 * klassisches Skript darf das: die Map gilt fuer das Dokument, nicht fuer die
 * Datei.
 */
function ladePublicI18nModul() {
  return import("@app/i18n/i18n.js");
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
  // Hell ist der bewusste Auslieferungszustand. Erst eine eigene Wahl des
  // Nutzers weicht davon ab; die Systemeinstellung entscheidet absichtlich
  // nicht mit, damit alle Besucher denselben ersten Eindruck erhalten.
  let theme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : "light";

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
  const keysByPath = {
    "/": "nav.home",
    "/ueber-uns/": "footer.about",
    "/flashbox-einrichten/": "nav.usb_helper",
    "/nachbauprojekte/": "nav.rebuild_projects",
    "/wissen/": "nav.knowledge",
    "/community/": "nav.community",
    "/hilfe/": "nav.help",
    "/support/": "nav.support",
    "/leistungen/": "nav.services",
    "/shop/": "nav.shop",
    "/app/auth/": "nav.login",
  };
  document.querySelectorAll(".site-menu a").forEach((link) => {
    const pathname = new URL(link.href, window.location.origin).pathname;
    if (keysByPath[pathname] && !link.dataset.publicLogout && !link.querySelector("[data-i18n]")) {
      link.dataset.i18n = keysByPath[pathname];
    }
  });
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

/*
 * Lebendige Bindung: auth.js fuehrt sie ein und liest damit immer den
 * aktuellen Wert. Zuvor stand hier eine Zuweisung an window; der Leser konnte
 * nur einen Schnappschuss nehmen und brauchte dafuer einen Rennschutz.
 */
export { publicI18n };
