const form = document.querySelector("#login-form");
const statusElement = document.querySelector("#status");
const nextUrl = new URLSearchParams(window.location.search).get("next") || "/app/dashboard/";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const identifier = data.get("identifier");
  const password = data.get("password");
  statusElement.textContent = "Login wird geprueft...";

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password, next: nextUrl }),
    });
    const payload = await response.json();
    if (!response.ok) {
      statusElement.textContent = payload.message || "Login fehlgeschlagen.";
      return;
    }

    statusElement.textContent = `Willkommen ${payload.account.username}. Plattform wird geoeffnet...`;
    window.location.href = payload.next || "/app/dashboard/";
  } catch {
    statusElement.textContent = "Login-Service ist gerade nicht erreichbar.";
  }
});

document.querySelectorAll("[data-provider]").forEach((button) => {
  button.addEventListener("click", () => {
    const provider = button.dataset.provider;
    statusElement.textContent = `Social Login mit ${provider} ist fuer diese lokale Demo noch nicht aktiviert.`;
  });
});
