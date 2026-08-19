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

function deviceOnboarding() { return platformComponent("deviceOnboarding"); }
function guidedProjectView() { return platformComponent("guidedProjectView"); }
function developmentPlatform() { return platformComponent("developmentPlatform"); }
