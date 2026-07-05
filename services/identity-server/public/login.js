const form = document.querySelector("#login-form");
const statusElement = document.querySelector("#status");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const identifier = data.get("identifier");
  statusElement.textContent = `Login vorbereitet fuer ${identifier}. API-Anbindung folgt.`;
});

document.querySelectorAll("[data-provider]").forEach((button) => {
  button.addEventListener("click", () => {
    const provider = button.dataset.provider;
    statusElement.textContent = `Social Login mit ${provider} vorbereitet. Provider ist aktuell gemockt.`;
  });
});
