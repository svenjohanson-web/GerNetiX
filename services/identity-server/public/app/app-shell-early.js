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

document.querySelector("#mainMenuButton")?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMainMenu();
});
document.querySelector("#mainMenu")?.addEventListener("click", (event) => {
  event.stopPropagation();
});
document.addEventListener("click", closeMainMenu);
