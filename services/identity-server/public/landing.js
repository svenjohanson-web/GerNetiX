const menuButton = document.querySelector("#publicMenuButton");
const menu = document.querySelector("#publicMenu");
let publicI18n = null;

const publicI18nReady = initializePublicI18n();

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

function decoratePublicNavigation() {
  const keysByPath = {
    "/": "nav.home",
    "/flashbox-einrichten/": "nav.usb_helper",
    "/nachbauprojekte/": "nav.rebuild_projects",
    "/wissen/": "nav.knowledge",
    "/community/": "nav.community",
    "/hilfe/": "nav.help",
    "/support/": "nav.support",
    "/shop/": "nav.shop",
    "/app/auth/": "nav.login",
  };
  document.querySelectorAll(".site-menu a").forEach((link) => {
    const pathname = new URL(link.href, window.location.origin).pathname;
    if (keysByPath[pathname]) link.dataset.i18n = keysByPath[pathname];
  });
  menuButton.dataset.i18nAriaLabel = "menu.open";
  menu.dataset.i18nAriaLabel = "nav.public";
}

function tr(key, fallback) {
  return publicI18n ? publicI18n.t(key, {}, fallback) : fallback;
}

function closeMenu() {
  menu.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", tr("menu.open", "Menü öffnen"));
}

function openMenu() {
  menu.hidden = false;
  menuButton.setAttribute("aria-expanded", "true");
  menuButton.setAttribute("aria-label", tr("menu.close", "Menü schließen"));
}

menuButton.addEventListener("click", (event) => {
  event.stopPropagation();
  if (menu.hidden) openMenu();
  else closeMenu();
});

menu.addEventListener("click", (event) => {
  event.stopPropagation();
  if (event.target.closest("a")) closeMenu();
});

document.addEventListener("click", closeMenu);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMenu();
});
