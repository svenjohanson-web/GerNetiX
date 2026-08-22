"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CHECKS,
  INVENTORY_TABLES,
  formatReport,
  readInventory,
  runRestoreContractChecks,
} = require("./restore-contract-checks");

// Ein gesunder Stand: Bestandstabellen gefuellt, keine verwaisten Beziehungen.
function healthyDatabase(overrides = {}) {
  const counts = {
    identity_user_accounts: 12,
    project_projects: 30,
    project_artifacts: 44,
    device_management_devices: 9,
    device_management_account_devices: 9,
    hardware_catalog_items: 25,
    hardware_shop_orders: 6,
    ...overrides.counts,
  };
  const violations = { ...overrides.violations };
  return async (sql) => {
    const simpleCount = /^SELECT count\(\*\) FROM (\w+)$/.exec(sql);
    if (simpleCount) return String(counts[simpleCount[1]] ?? 0);
    for (const [name, value] of Object.entries(violations)) {
      const check = CHECKS.find((entry) => entry.name === name);
      if (check && sql === check.sql) return String(value);
    }
    return "0";
  };
}

test("bestaetigt einen fachlich brauchbaren Wiederherstellungspunkt", async () => {
  const report = await runRestoreContractChecks(healthyDatabase());
  assert.equal(report.passed, true);
  assert.deepEqual(report.failed, []);
  assert.equal(report.checks.length, CHECKS.length);
  assert.equal(report.inventory.length, INVENTORY_TABLES.length);
});

test("erkennt ein Projekt ohne Account", async () => {
  const report = await runRestoreContractChecks(healthyDatabase({ violations: { projekte_haben_accounts: 3 } }));
  assert.equal(report.passed, false);
  assert.deepEqual(report.failed, ["projekte_haben_accounts"]);
  assert.match(formatReport(report), /FEHLER\] projekte_haben_accounts: 3/);
});

test("erkennt eine unvollstaendige Repository-Bindung", async () => {
  const report = await runRestoreContractChecks(
    healthyDatabase({ violations: { repository_bindung_vollstaendig: 1 } }),
  );
  assert.deepEqual(report.failed, ["repository_bindung_vollstaendig"]);
});

test("erkennt verwaiste Pairings, Artefakte und Bestellungen", async () => {
  const report = await runRestoreContractChecks(
    healthyDatabase({
      violations: {
        pairings_haben_accounts: 2,
        pairings_haben_geraete: 1,
        artefakte_haben_projekte: 5,
        bestellungen_haben_accounts: 1,
      },
    }),
  );
  assert.deepEqual(report.failed, [
    "artefakte_haben_projekte",
    "pairings_haben_accounts",
    "pairings_haben_geraete",
    "bestellungen_haben_accounts",
  ]);
});

test("erkennt einen leeren Stand als Fehlschlag statt als Erfolg", async () => {
  const report = await runRestoreContractChecks(
    healthyDatabase({ counts: { identity_user_accounts: 0, hardware_catalog_items: 0 } }),
  );
  assert.equal(report.passed, false);
  assert.deepEqual(report.failed, ["accounts_vorhanden", "hardware_inventar_vorhanden"]);
});

test("haelt den Bestand gegen den Stand zum Sicherungszeitpunkt", async () => {
  const expectedRowCounts = await readInventory(healthyDatabase());
  const unveraendert = await runRestoreContractChecks(healthyDatabase(), { expectedRowCounts });
  assert.deepEqual(unveraendert.deviations, []);
  assert.ok(unveraendert.inventory.every((entry) => entry.matches === true));

  const verloren = await runRestoreContractChecks(healthyDatabase({ counts: { project_projects: 28 } }), {
    expectedRowCounts,
  });
  assert.deepEqual(verloren.deviations, ["project_projects: erwartet 30, gefunden 28"]);
});

test("nennt einen fehlenden Vergleichswert als solchen statt ihn zu bestehen", async () => {
  const report = await runRestoreContractChecks(healthyDatabase());
  assert.ok(report.inventory.every((entry) => entry.matches === null && entry.expected === null));
  assert.match(formatReport(report), /ohne Vergleichswert/);
});

test("bricht ab, wenn eine Pruefung kein Ergebnis liefert", async () => {
  const broken = async () => "FEHLER:  Relation identity_user_accounts existiert nicht";
  await assert.rejects(runRestoreContractChecks(broken), /lieferte kein Ergebnis/);
});

test("jede Pruefung nennt genau eine Zahl und eine Erwartung", () => {
  for (const check of CHECKS) {
    assert.match(check.sql, /^SELECT count\(\*\)/);
    assert.ok(["zero", "positive"].includes(check.expect));
    assert.ok(check.description.endsWith("."));
  }
});
