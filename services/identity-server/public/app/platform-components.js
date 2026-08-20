/*
 * Registratur der Plattform-Bausteine.
 *
 * Zuvor holten Controller sich andere Controller bei app.js ab -- der
 * Verdrahtung, also der obersten Schicht. deviceOnboarding wurde 16 mal so
 * gerufen, developmentPlatform 9 mal, guidedProjectView 5 mal. Jeder dieser
 * Aufrufe lief verkehrt herum.
 *
 * Jetzt liegen die Namen hier unten und ohne eigene Abhaengigkeiten. Die
 * Verdrahtung meldet ihre Fabriken an, die Controller fragen nur noch nach.
 * Erzeugt wird weiterhin erst beim ersten Zugriff.
 */
const platformComponentFactories = new Map();
const platformComponentInstances = new Map();

function registerPlatformComponent(name, factory) {
  platformComponentFactories.set(name, factory);
}

function platformComponent(name) {
  if (!platformComponentInstances.has(name)) {
    const factory = platformComponentFactories.get(name);
    if (!factory) throw new Error(`Plattform-Baustein nicht angemeldet: ${name}`);
    platformComponentInstances.set(name, factory());
  }
  return platformComponentInstances.get(name);
}

/*
 * Liefert einen Baustein nur, wenn er bereits gebaut wurde -- ohne ihn
 * anzulegen. Ersetzt Stellen, die frueher die Haltevariable direkt mit
 * quizController?.render() abfragten und damit bewusst nichts erzeugten.
 */
function platformComponentIfBuilt(name) {
  return platformComponentInstances.get(name) || null;
}

function deviceOnboarding() { return platformComponent("deviceOnboarding"); }
function guidedProjectView() { return platformComponent("guidedProjectView"); }
function developmentPlatform() { return platformComponent("developmentPlatform"); }
function learningProject() { return platformComponent("learningProject"); }
function quiz() { return platformComponent("quiz"); }
function projectApp() { return platformComponent("projectApp"); }
function deviceDebug() { return platformComponent("deviceDebug"); }

/*
 * Meldungen von unten nach oben. Ein Controller, der die Huelle etwas tun
 * lassen will, ruft sie nicht mehr, sondern meldet es. Der Name steht hier,
 * weil beide Seiten ihn brauchen und diese Datei an nichts haengt.
 */
const SERIAL_SERVICE_CHOICE_EVENT = "gernetix:serial-service-choice";

const DASHBOARD_STALE_EVENT = "gernetix:dashboard-stale";
const IDE_DEBUG_STOP_EVENT = "gernetix:ide-debug-stop";
