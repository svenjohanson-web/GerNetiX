const state = {
  life: "lebendig",
  hunger: 35,
  thirst: 25,
  energy: 80,
  joy: 70,
  mood: "neugierig",
  message: "Ich bin bereit.",
};

const elements = {
  sessionPill: document.querySelector("#session-pill"),
  logoutButton: document.querySelector("#logout-button"),
  connectionState: document.querySelector("#connection-state"),
  petBody: document.querySelector("#pet-body"),
  petMouth: document.querySelector("#pet-mouth"),
  petMessage: document.querySelector("#pet-message"),
  lifeState: document.querySelector("#life-state"),
  hungerState: document.querySelector("#hunger-state"),
  thirstState: document.querySelector("#thirst-state"),
  moodState: document.querySelector("#mood-state"),
  hungerMeter: document.querySelector("#hunger-meter"),
  thirstMeter: document.querySelector("#thirst-meter"),
  energyMeter: document.querySelector("#energy-meter"),
  joyMeter: document.querySelector("#joy-meter"),
};

document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => applyAction(button.dataset.action));
});

elements.logoutButton.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/login.html";
});

loadSession();
render();

window.setInterval(() => {
  if (state.life === "tot") {
    return;
  }

  state.hunger = clamp(state.hunger + 2);
  state.thirst = clamp(state.thirst + 2);
  state.energy = clamp(state.energy - 1);
  state.joy = clamp(state.joy - 1);
  recomputeState("Tama wartet auf die naechste Aktion.");
  render();
}, 3000);

async function loadSession() {
  try {
    const response = await fetch("/api/session");
    if (!response.ok) {
      window.location.href = "/login.html?next=/demo/tamagotchi/";
      return;
    }

    const session = await response.json();
    const username = session.account && session.account.username ? session.account.username : "Demo";
    elements.sessionPill.textContent = username;
    elements.connectionState.textContent = "Verbunden";
  } catch (error) {
    elements.connectionState.textContent = "Offline";
  }
}

function applyAction(action) {
  if (state.life === "tot") {
    state.message = "Tama ist tot. Das Modell hat den Endzustand erreicht.";
    render();
    return;
  }

  if (action === "feed") {
    state.hunger = 0;
    state.joy = clamp(state.joy + 6);
    recomputeState("Danke, das hat geschmeckt.");
  }

  if (action === "drink") {
    state.thirst = 0;
    state.joy = clamp(state.joy + 5);
    recomputeState("Frisches Wasser. Viel besser.");
  }

  if (action === "play") {
    state.joy = clamp(state.joy + 16);
    state.energy = clamp(state.energy - 12);
    state.hunger = clamp(state.hunger + 4);
    state.thirst = clamp(state.thirst + 4);
    recomputeState("Das war spannend.");
  }

  if (action === "sleep") {
    state.energy = clamp(state.energy + 24);
    state.joy = clamp(state.joy - 2);
    recomputeState("Tama ruht sich aus.");
  }

  render();
}

function recomputeState(message) {
  if (state.hunger >= 100 || state.thirst >= 100) {
    state.life = "tot";
    state.mood = "still";
    state.message = "Das Modell wechselt in den Zustand tot.";
    return;
  }

  state.life = "lebendig";
  if (state.hunger >= 75 || state.thirst >= 75) {
    state.mood = "angespannt";
  } else if (state.energy <= 20) {
    state.mood = "muede";
  } else if (state.joy >= 70) {
    state.mood = "zufrieden";
  } else {
    state.mood = "neugierig";
  }
  state.message = message;
}

function render() {
  elements.lifeState.textContent = state.life;
  elements.hungerState.textContent = state.hunger >= 50 ? "hungrig" : "satt";
  elements.thirstState.textContent = state.thirst >= 50 ? "durstig" : "nicht durstig";
  elements.moodState.textContent = state.mood;
  elements.petMessage.textContent = state.message;

  elements.hungerMeter.value = state.hunger;
  elements.thirstMeter.value = state.thirst;
  elements.energyMeter.value = state.energy;
  elements.joyMeter.value = state.joy;

  elements.petBody.classList.toggle("is-happy", state.mood === "zufrieden");
  elements.petBody.classList.toggle("is-tired", state.mood === "muede");
  elements.petBody.classList.toggle("is-dead", state.life === "tot");
  elements.petMouth.classList.toggle(
    "is-sad",
    state.mood === "angespannt" || state.mood === "muede" || state.life === "tot",
  );
}

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}
