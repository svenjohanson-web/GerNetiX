"use strict";

(function registerTamagotchiRuntimeAdapter() {
function openTamagotchiRunPreview() {
  closeTamagotchiRunPreview();

  const transitions = lesson.learnerProfile?.tamagotchiTransitions || {};
  const source = lesson.learnerProfile?.tamagotchiPlantUmlSource || "";
  const customStates = getCustomTamagotchiStatesFromSource(source);
  getCustomTamagotchiTransitionsFromSource(source, customStates);
  const runtimeModel = parseTamagotchiRuntimeModel(source);
  let hunger = parsePlantUmlInitialValue(source, "Hunger", 45);
  let thirst = parsePlantUmlInitialValue(source, "Durst", null);
  let canClose = false;

  const overlay = document.createElement("div");
  overlay.className = "runtime-modal";
  overlay.dataset.runtimeModal = "tamagotchi";
  overlay.innerHTML = `
    <section class="runtime-dialog" role="dialog" aria-modal="true" aria-label="Tamagotchi Webanwendung">
      <div class="runtime-dialog-header">
        <div>
          <p class="step-kicker">Ausführbare Webanwendung</p>
          <h2>Tamagotchi</h2>
        </div>
        <button type="button" class="runtime-close" data-action="close-runtime-preview" aria-label="Schließen" disabled title="Schließen ist möglich, sobald das Tamagotchi hungrig ist.">×</button>
      </div>
      <div class="tamagotchi-app-preview">
        <div class="tamagotchi-pet" data-tamagotchi-pet aria-hidden="true">
          <div class="tamagotchi-face">
            <span></span>
            <span></span>
            <i></i>
          </div>
        </div>
        <div class="tamagotchi-data">
          <dl>
            <div>
              <dt>Name</dt>
              <dd>Tama</dd>
            </div>
            <div>
              <dt>Zustand</dt>
              <dd data-tamagotchi-life>lebendig</dd>
            </div>
            <div>
              <dt>Unterzustand</dt>
              <dd data-tamagotchi-substate>satt</dd>
            </div>
            <div>
              <dt>Hunger</dt>
              <dd data-tamagotchi-hunger>${hunger} / 100</dd>
            </div>
            ${thirst === null ? "" : `
              <div>
                <dt>Durst</dt>
                <dd data-tamagotchi-thirst>${thirst} / 100</dd>
              </div>
            `}
            <div>
              <dt>Letzte Fütterung</dt>
              <dd>gerade eben</dd>
            </div>
          </dl>
        </div>
      </div>
      <div class="runtime-transition-list">
        <strong>Übergänge aus dem Modell</strong>
        <ul>
          <li>satt → hungrig: ${escapeHtml(transitions.sattToHungry || "Hunger >= 50")}</li>
          <li>hungrig → satt: ${escapeHtml(transitions.hungryToSatt || "füttern")}</li>
          <li>hungrig → tot: ${escapeHtml(transitions.hungryToDead || "Hunger = 100")}</li>
          ${customStates.map((state) => `<li>${escapeHtml(state.from || "eigener State")} → ${escapeHtml(state.label)}: ${escapeHtml(state.condition || "noch offen")}</li>`).join("")}
        </ul>
      </div>
      <p class="runtime-close-note" data-runtime-close-note>Das Fenster lässt sich schließen, sobald der Zustand zu hungrig wechselt.</p>
    </section>
  `;

  overlay.addEventListener("click", (event) => {
    const action = event.target.dataset?.action;
    if ((action === "close-runtime-preview" || event.target === overlay) && canClose) {
      closeTamagotchiRunPreview();
    }
  });

  document.body.append(overlay);

  updateTamagotchiRunPreview(overlay, hunger, thirst, runtimeModel);

  overlay.runtimeTimer = window.setInterval(() => {
    hunger = Math.min(100, hunger + runtimeModel.hungerIncrement);
    if (thirst !== null && runtimeModel.thirstIncrement > 0) {
      thirst = Math.min(100, thirst + runtimeModel.thirstIncrement);
    }
    updateTamagotchiRunPreview(overlay, hunger, thirst, runtimeModel);
    const state = resolveTamagotchiRuntimeState(hunger, thirst, runtimeModel);
    canClose = state.isHungry || state.isThirsty || state.isDead;
    updateTamagotchiRunPreviewCloseState(overlay, canClose);
  }, 3000);
}

function getCustomTamagotchiStatesFromSource(source) {
  const states = getPlantUmlStatesInBlockFromText(source, 'state "lebendig"');
  const builtInAliases = new Set(["satt", "hungrig"]);
  return states.filter((state) => !builtInAliases.has(state.alias));
}

function getCustomTamagotchiTransitionsFromSource(source, states) {
  const byAlias = new Map(states.map((state) => [state.alias, state]));

  source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .forEach((line) => {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+-->\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/);
      if (!match || !byAlias.has(match[2])) return;
      const state = byAlias.get(match[2]);
      state.from = match[1];
      state.condition = match[3].trim();
    });

  return states;
}

function parsePlantUmlInitialValue(source, name, fallback) {
  const match = source.match(new RegExp(`^\\s*${escapeRegExp(name)}\\s*=\\s*(-?\\d+)\\s*$`, "mi"));
  return match ? Number(match[1]) : fallback;
}

function parseTamagotchiRuntimeModel(source) {
  return {
    hungerIncrement: parsePlantUmlTickIncrement(source, "Hunger"),
    thirstIncrement: parsePlantUmlTickIncrement(source, "Durst"),
    transitions: parsePlantUmlTransitions(source),
  };
}

function parsePlantUmlTickIncrement(source, name) {
  const match = source.match(new RegExp(`${escapeRegExp(name)}\\s*=\\s*${escapeRegExp(name)}\\s*\\+\\s*(\\d+)`, "i"));
  return match ? Number(match[1]) : 0;
}

function parsePlantUmlTransitions(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+-->\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/))
    .filter(Boolean)
    .map((match) => ({
      from: match[1],
      to: match[2],
      condition: match[3].trim(),
    }));
}

function updateTamagotchiRunPreview(overlay, hunger, thirst, runtimeModel) {
  const state = resolveTamagotchiRuntimeState(hunger, thirst, runtimeModel);
  const hungerDisplay = overlay.querySelector("[data-tamagotchi-hunger]");
  const thirstDisplay = overlay.querySelector("[data-tamagotchi-thirst]");
  const lifeDisplay = overlay.querySelector("[data-tamagotchi-life]");
  const substateDisplay = overlay.querySelector("[data-tamagotchi-substate]");
  const petDisplay = overlay.querySelector("[data-tamagotchi-pet]");

  if (hungerDisplay) hungerDisplay.textContent = `${hunger} / 100`;
  if (thirstDisplay) thirstDisplay.textContent = `${thirst} / 100`;
  if (lifeDisplay) lifeDisplay.textContent = state.isDead ? "tot" : "lebendig";
  if (substateDisplay) substateDisplay.textContent = state.isDead ? "-" : renderTamagotchiSubstateLabel(state.isHungry, state.isThirsty);
  if (petDisplay) petDisplay.classList.toggle("is-hungry", state.isHungry || state.isThirsty);
  if (petDisplay) petDisplay.classList.toggle("is-dead", state.isDead);
}

function resolveTamagotchiRuntimeState(hunger, thirst, runtimeModel) {
  const isHungry = hasTriggeredTransition(runtimeModel, "satt", "hungrig", { Hunger: hunger, Durst: thirst });
  const isThirsty = thirst !== null
    && hasTriggeredTransition(runtimeModel, "nicht_durstig", "durstig", { Hunger: hunger, Durst: thirst });
  const activeAliases = new Set(["satt", "nicht_durstig"]);
  if (isHungry) activeAliases.add("hungrig");
  if (isThirsty) activeAliases.add("durstig");

  const isDead = runtimeModel.transitions.some((transition) =>
    transition.to === "tot"
    && activeAliases.has(transition.from)
    && evaluateSimpleCondition(transition.condition, { Hunger: hunger, Durst: thirst })
  );

  return { isDead, isHungry, isThirsty };
}

function hasTriggeredTransition(runtimeModel, from, to, values) {
  return runtimeModel.transitions.some((transition) =>
    transition.from === from
    && transition.to === to
    && evaluateSimpleCondition(transition.condition, values)
  );
}

function evaluateSimpleCondition(condition, values) {
  const match = condition.match(/^(Hunger|Durst)\s*(>=|=|==|>|<=|<)\s*(-?\d+)$/i);
  if (!match) return false;

  const valueName = match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
  const currentValue = values[valueName];
  const targetValue = Number(match[3]);
  if (currentValue === null || currentValue === undefined) return false;

  if (match[2] === ">=") return currentValue >= targetValue;
  if (match[2] === ">" ) return currentValue > targetValue;
  if (match[2] === "<=") return currentValue <= targetValue;
  if (match[2] === "<") return currentValue < targetValue;
  return currentValue === targetValue;
}

function renderTamagotchiSubstateLabel(isHungry, isThirsty) {
  if (isHungry && isThirsty) return "hungrig / durstig";
  if (isHungry) return "hungrig";
  if (isThirsty) return "durstig";
  return "satt";
}

function updateTamagotchiRunPreviewCloseState(overlay, canClose) {
  const closeButton = overlay.querySelector('[data-action="close-runtime-preview"]');
  const closeNote = overlay.querySelector("[data-runtime-close-note]");

  if (closeButton) {
    closeButton.disabled = !canClose;
    closeButton.title = canClose
      ? "Schließen"
      : "Schließen ist möglich, sobald das Tamagotchi hungrig ist.";
  }

  if (closeNote) {
    closeNote.textContent = canClose
      ? "Das Tamagotchi ist hungrig. Das Fenster kann jetzt geschlossen werden."
      : "Das Fenster lässt sich schließen, sobald der Zustand zu hungrig wechselt.";
    closeNote.classList.toggle("ok", canClose);
  }
}

function closeTamagotchiRunPreview() {
  const overlay = document.querySelector('[data-runtime-modal="tamagotchi"]');
  if (!overlay) return;
  window.clearInterval(overlay.runtimeTimer);
  overlay.remove();
}

function normalizeTamagotchiRuntimeState(lessonItem) {
  if (!lessonItem?.learnerProfile) return;

  const oldDeathCondition = "1 Tag nicht gefüttert";
  const newDeathCondition = "Hunger = 100";
  const source = lessonItem.learnerProfile.tamagotchiPlantUmlSource || "";
  const transitions = lessonItem.learnerProfile.tamagotchiTransitions || {};

  lessonItem.learnerProfile = {
    ...lessonItem.learnerProfile,
    tamagotchiTransitions: {
      ...transitions,
      hungryToDead: transitions.hungryToDead === oldDeathCondition
        ? newDeathCondition
        : transitions.hungryToDead || newDeathCondition,
    },
    tamagotchiPlantUmlSource: source
      .replaceAll(`hungrig --> tot : ${oldDeathCondition}`, `hungrig --> tot : ${newDeathCondition}`),
  };
}


  registerRuntimePreviewAdapter("tamagotchiBrowserApp", {
    open: openTamagotchiRunPreview,
    normalize: normalizeTamagotchiRuntimeState,
    restore(lessonItem, payload) {
      lessonItem.learnerProfile = {
        ...(lessonItem.learnerProfile || {}),
        tamagotchiTransitions: {
          ...(lessonItem.learnerProfile?.tamagotchiTransitions || {}),
          ...(payload.tamagotchiTransitions || {}),
        },
        tamagotchiPlantUmlSource: lessonItem.runtimeDefaults?.tamagotchiPlantUmlSource || lessonItem.learnerProfile?.tamagotchiPlantUmlSource || "",
      };
      normalizeTamagotchiRuntimeState(lessonItem);
    },
    serialize(lessonItem) {
      normalizeTamagotchiRuntimeState(lessonItem);
      return { tamagotchiTransitions: lessonItem.learnerProfile?.tamagotchiTransitions || {} };
    },
  });
})();
