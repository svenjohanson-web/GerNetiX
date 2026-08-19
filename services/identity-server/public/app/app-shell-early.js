// Keep the platform header interactive while route-specific modules are still loading.
function toggleMainMenu() {
  const menu = document.querySelector("#mainMenu");
  const button = document.querySelector("#mainMenuButton");
  if (!menu || !button) return;
  const open = menu.classList.toggle("hidden") === false;
  button.setAttribute("aria-expanded", open ? "true" : "false");
}

function closeMainMenu() {
  const menu = document.querySelector("#mainMenu");
  const button = document.querySelector("#mainMenuButton");
  if (!menu || menu.classList.contains("hidden")) return;
  menu.classList.add("hidden");
  button?.setAttribute("aria-expanded", "false");
}

// Der gewaehlte Modus wird bereits im Dokumentkopf angewendet, damit nichts
// aufblitzt. Hier wird nur noch die Schaltflaeche bedienbar gemacht.
function initializePlatformTheme() {
  const storageKey = "gernetix-public-theme";
  const root = document.documentElement;
  const button = document.querySelector("#platformThemeToggle");
  if (!button) return;

  const beschriften = () => {
    const dunkel = root.dataset.publicTheme === "dark";
    const label = dunkel ? "Helles Design einschalten" : "Dunkles Design einschalten";
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.setAttribute("aria-pressed", String(dunkel));
    button.textContent = dunkel ? "☀" : "◐";
  };

  beschriften();
  button.addEventListener("click", () => {
    const naechster = root.dataset.publicTheme === "dark" ? "light" : "dark";
    root.dataset.publicTheme = naechster;
    try {
      window.localStorage.setItem(storageKey, naechster);
    } catch (fehler) {
      /* Ohne Speicher gilt die Wahl nur fuer diese Sitzung. */
    }
    beschriften();
  });
}

initializePlatformTheme();

document.querySelector("#mainMenuButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMainMenu();
});
document.querySelector("#mainMenu")?.addEventListener("click", (event) => {
  event.stopPropagation();
});
document.addEventListener("click", closeMainMenu);
