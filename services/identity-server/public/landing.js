const menuButton = document.querySelector("#publicMenuButton");
const menu = document.querySelector("#publicMenu");

function closeMenu() {
  menu.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Menü öffnen");
}

function openMenu() {
  menu.hidden = false;
  menuButton.setAttribute("aria-expanded", "true");
  menuButton.setAttribute("aria-label", "Menü schließen");
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
