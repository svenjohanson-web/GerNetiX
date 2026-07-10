const form = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const modeToggle = document.querySelector("#auth-mode-toggle");
const titleElement = document.querySelector("#login-title");
const statusElement = document.querySelector("#status");
const query = new URLSearchParams(window.location.search);
const nextUrl = query.get("next") || "/app/dashboard/";
let authMode = query.get("mode") === "register" ? "register" : "login";

applyAuthMode({ updateUrl: false });

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

    await storePasswordCredential({
      id: identifier,
      name: payload.account.username,
      password,
    });
    statusElement.textContent = `Willkommen ${payload.account.username}. Plattform wird geoeffnet...`;
    window.location.href = payload.next || "/app/dashboard/";
  } catch {
    statusElement.textContent = "Login-Service ist gerade nicht erreichbar.";
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(registerForm);
  const username = data.get("username");
  const email = data.get("email");
  const password = data.get("password");
  statusElement.textContent = "Konto wird erstellt...";

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        email,
        password,
        password_repeat: data.get("password_repeat"),
        accepted_terms: data.get("accepted_terms") === "on",
        next: nextUrl,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      statusElement.textContent = payload.message || "Konto konnte nicht erstellt werden.";
      return;
    }

    await storePasswordCredential({
      id: email,
      name: username,
      password,
    });
    statusElement.textContent = `Willkommen ${payload.account.username}. Plattform wird geoeffnet...`;
    window.location.href = payload.next || "/app/dashboard/";
  } catch {
    statusElement.textContent = "Registrierung ist gerade nicht erreichbar.";
  }
});

modeToggle.addEventListener("click", () => {
  authMode = authMode === "login" ? "register" : "login";
  applyAuthMode({ updateUrl: true });
});

function applyAuthMode({ updateUrl }) {
  form.classList.toggle("hidden", authMode !== "login");
  registerForm.classList.toggle("hidden", authMode !== "register");
  titleElement.textContent = authMode === "login" ? "Anmelden" : "Konto erstellen";
  modeToggle.textContent = authMode === "login" ? "Konto erstellen" : "Zur Anmeldung";
  statusElement.textContent = "";
  if (updateUrl) {
    const nextQuery = new URLSearchParams(window.location.search);
    if (authMode === "register") nextQuery.set("mode", "register");
    else nextQuery.delete("mode");
    const search = nextQuery.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }
}

async function storePasswordCredential({ id, name, password }) {
  if (!window.PasswordCredential || !navigator.credentials?.store || !id || !password) return;
  try {
    await navigator.credentials.store(new PasswordCredential({
      id: String(id),
      name: String(name || id),
      password: String(password),
    }));
  } catch {
    // Browser or user policy may decline saving credentials; login still succeeds.
  }
}

document.querySelectorAll("[data-provider]").forEach((button) => {
  button.addEventListener("click", async () => {
    const provider = button.dataset.provider;
    const email = window.prompt(`Lokaler ${provider}-Dev-Login: E-Mail fuer den Account`);
    if (!email) {
      statusElement.textContent = "Social Login abgebrochen.";
      return;
    }
    const username = window.prompt("Anzeigename optional", email.split("@")[0]) || "";
    statusElement.textContent = `${provider}-Login wird lokal angelegt...`;
    try {
      const response = await fetch("/api/login/external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          email,
          username,
          next: nextUrl,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        statusElement.textContent = payload.message || "Social Login fehlgeschlagen.";
        return;
      }
      statusElement.textContent = `Willkommen ${payload.account.username}. Plattform wird geoeffnet...`;
      window.location.href = payload.next || "/app/dashboard/";
    } catch {
      statusElement.textContent = "Login-Service ist gerade nicht erreichbar.";
    }
  });
});
