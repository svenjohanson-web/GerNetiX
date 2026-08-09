# Lesson-Module-Pattern

Jedes Lernprojekt besitzt genau eine Datei `<slug>.lesson.js`. Das Modul
registriert eine Factory mit demselben Vertrag:

```js
window.LearningProjectRegistry.register({
  slug: "mein-lernprojekt",
  create(pattern) {
    return {
      projectIdeaId: "project_idea.mein_lernprojekt",
      projectVariantId: "variant.meine_variante",
      slug: "mein-lernprojekt",
      title: "Mein Lernprojekt",
      source: "...",
      steps: [],
    };
  },
});
```

Die Factory muss ein Projekt mit demselben `slug`, einer eindeutigen
`projectIdeaId`, Quellinhalt und mindestens einem Schritt liefern. Kleine
Vorschauprojekte verwenden die gemeinsamen Builder aus `lesson-pattern.js`;
vollstaendige Kurse duerfen ihre projektspezifischen Hilfsfunktionen lokal im
eigenen Modul halten.

Neue Module werden nach `lesson-pattern.js` und `lesson-registry.js`, aber vor
den allgemeinen Laufzeitmodulen in `index.html` aufgenommen. `app-state.js`
konsumiert nur `LearningProjectRegistry.createAll()`; `app.js` enthaelt lediglich
den Anwendungsstart.

Benötigt ein Lernprojekt eine ausfuehrbare Vorschau, registriert es dafuer einen
Adapter unter `adapters/`. Allgemeines Rendering, Navigation, Validierung und
Speichern duerfen keine projektspezifische Vorschauimplementierung enthalten.
