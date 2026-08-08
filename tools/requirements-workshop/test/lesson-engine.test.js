const test = require("node:test");
const assert = require("node:assert/strict");
const engine = require("../lesson-engine");

test("spiegelt einen unscharfen Anmeldewunsch ohne eine Technik zu erfinden", () => {
  const analysis = engine.analyseProposal("Ein Mitarbeiter soll sich an einer Maschine anmelden können.");

  assert.ok(analysis.understood.some((item) => item.includes("Mitarbeiter")));
  assert.ok(analysis.assumptions.some((item) => item.id === "auth-method"));
  assert.ok(analysis.unclear.some((item) => item.includes("Netzwerk")));
  assert.ok(analysis.score < 80);
});

test("erkennt Fachverfahren und messbare Qualitätskriterien", () => {
  const analysis = engine.analyseProposal(
    "Ein Mitarbeiter authentifiziert sich an der Maschine mit einer RFID-Karte. Die Prüfung dauert höchstens 500 Millisekunden und funktioniert offline."
  );

  assert.equal(analysis.assumptions.some((item) => item.id === "auth-method"), false);
  assert.equal(analysis.measurable, true);
  assert.ok(analysis.score > 60);
});

test("klassifiziert funktionale Sicherheitsreaktionen getrennt von NFR", () => {
  const pinLock = engine.CLASSIFICATION_CARDS.find((item) => item.id === "pin-lock");
  const responseTime = engine.CLASSIFICATION_CARDS.find((item) => item.id === "response-time");

  assert.equal(pinLock.expected, "functional");
  assert.equal(responseTime.expected, "nfr");
});

test("erzeugt eine Spezifikation aus Kontext und Verfahrenswahl", () => {
  const specification = engine.buildSpecification({
    selectedMethod: "rfid",
    context: { offline: "yes", critical: "yes", risks: ["Nachweis geht verloren"] }
  });

  assert.ok(specification.functional.some((item) => item.includes("RFID")));
  assert.ok(specification.functional.some((item) => item.includes("zusätzlicher")));
  assert.ok(specification.nfr.some((item) => item.includes("acht Stunden")));
  assert.ok(specification.acceptance.length >= 4);
});

test("berechnet den Lernstand aus den tatsächlich bearbeiteten Aufgaben", () => {
  const classificationAnswers = Object.fromEntries(
    engine.CLASSIFICATION_CARDS.map((card) => [card.id, card.expected])
  );
  const trapAnswers = Object.fromEntries(
    engine.TRAPS.map((trap) => [trap.id, trap.options.find((option) => option.correct).id])
  );
  const result = engine.calculateResult({
    classificationAnswers,
    trapAnswers,
    assumptionDecisions: { "auth-method": "open", authorization: "accept" },
    selectedMethod: "rfid"
  });

  assert.equal(result.classificationCorrect, engine.CLASSIFICATION_CARDS.length);
  assert.equal(result.trapsCorrect, engine.TRAPS.length);
  assert.equal(result.points, 100);
});
