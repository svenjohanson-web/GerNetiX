"use strict";

// Fachliche Pruefungen nach einem Restore. Ein technisch fehlerfreier
// pg_restore ist noch kein nutzbarer Stand: erst wenn die Beziehungen
// Account -> Projekt -> Repository -> Build-Artefakt und Account -> Geraet
// wieder stimmen, ist der Wiederherstellungspunkt fachlich brauchbar.

// Jede Pruefung liefert genau eine Zahl. Erwartet wird entweder null Verstoesse
// oder ein Bestand groesser null; beides ist unten ausdruecklich benannt.
const CHECKS = [
  {
    name: "accounts_vorhanden",
    description: "Der wiederhergestellte Stand enthaelt Accounts.",
    sql: "SELECT count(*) FROM identity_user_accounts",
    expect: "positive",
  },
  {
    name: "projekte_haben_accounts",
    description: "Kein Projekt zeigt auf einen Account, den es nicht mehr gibt.",
    sql:
      "SELECT count(*) FROM project_projects p " +
      "LEFT JOIN identity_user_accounts a ON a.id = p.user_id WHERE a.id IS NULL",
    expect: "zero",
  },
  {
    name: "repository_bindung_vollstaendig",
    description: "Jedes Projekt mit Repository nennt auch Repository-ID und erwarteten Commit.",
    sql:
      "SELECT count(*) FROM project_projects " +
      "WHERE repository_name IS NOT NULL AND repository_name <> '' " +
      "AND (repository_id IS NULL OR repository_id = '' OR head_sha IS NULL OR head_sha = '')",
    expect: "zero",
  },
  {
    name: "artefakte_haben_projekte",
    description: "Kein Build-Artefakt haengt an einem verschwundenen Projekt.",
    sql:
      "SELECT count(*) FROM project_artifacts ar " +
      "LEFT JOIN project_projects p ON p.project_id = ar.project_id WHERE p.project_id IS NULL",
    expect: "zero",
  },
  {
    name: "pairings_haben_accounts",
    description: "Kein Geraete-Pairing zeigt auf einen Account, den es nicht mehr gibt.",
    sql:
      "SELECT count(*) FROM device_management_account_devices ad " +
      "LEFT JOIN identity_user_accounts a ON a.id = ad.account_id WHERE a.id IS NULL",
    expect: "zero",
  },
  {
    name: "pairings_haben_geraete",
    description: "Kein Geraete-Pairing zeigt auf ein Geraet, das es nicht mehr gibt.",
    sql:
      "SELECT count(*) FROM device_management_account_devices ad " +
      "LEFT JOIN device_management_devices d ON d.device_id = ad.device_id WHERE d.device_id IS NULL",
    expect: "zero",
  },
  {
    name: "bestellungen_haben_accounts",
    description: "Keine Bestellung zeigt auf einen Account, den es nicht mehr gibt.",
    sql:
      "SELECT count(*) FROM hardware_shop_orders o " +
      "LEFT JOIN identity_user_accounts a ON a.id = o.account_id WHERE a.id IS NULL",
    expect: "zero",
  },
  {
    name: "hardware_inventar_vorhanden",
    description: "Das Hardware-Inventar ist wiederhergestellt.",
    sql: "SELECT count(*) FROM hardware_catalog_items",
    expect: "positive",
  },
];

// Zeilenzahlen, die gegen den Stand zum Sicherungszeitpunkt gehalten werden.
// Eine Abweichung ist kein automatischer Fehler, aber immer eine Feststellung.
const INVENTORY_TABLES = [
  "identity_user_accounts",
  "project_projects",
  "project_artifacts",
  "device_management_devices",
  "device_management_account_devices",
  "hardware_catalog_items",
  "hardware_shop_orders",
];

async function runRestoreContractChecks(query, options = {}) {
  const results = [];
  for (const check of CHECKS) {
    const value = await readCount(query, check.sql, check.name);
    const passed = check.expect === "zero" ? value === 0 : value > 0;
    results.push({
      name: check.name,
      description: check.description,
      expectation: check.expect === "zero" ? "0" : "> 0",
      actual: value,
      passed,
    });
  }

  const inventory = [];
  for (const table of INVENTORY_TABLES) {
    const actual = await readCount(query, `SELECT count(*) FROM ${table}`, table);
    const expected = options.expectedRowCounts?.[table];
    inventory.push({
      table,
      actual,
      expected: Number.isInteger(expected) ? expected : null,
      matches: Number.isInteger(expected) ? expected === actual : null,
    });
  }

  const failed = results.filter((result) => !result.passed);
  const deviations = inventory.filter((entry) => entry.matches === false);
  return {
    passed: failed.length === 0,
    checks: results,
    inventory,
    failed: failed.map((result) => result.name),
    deviations: deviations.map((entry) => `${entry.table}: erwartet ${entry.expected}, gefunden ${entry.actual}`),
  };
}

async function readCount(query, sql, label) {
  const output = await query(sql);
  const value = String(output ?? "").trim();
  if (!/^\d+$/.test(value)) throw new Error(`Pruefung ${label} lieferte kein Ergebnis: ${value.slice(0, 200)}`);
  return Number.parseInt(value, 10);
}

// Zeilenzahlen des produktiven Standes, damit ein spaeterer Restore gegen den
// Stand zum Sicherungszeitpunkt gehalten werden kann.
async function readInventory(query) {
  const counts = {};
  for (const table of INVENTORY_TABLES) {
    counts[table] = await readCount(query, `SELECT count(*) FROM ${table}`, table);
  }
  return counts;
}

function formatReport(report) {
  const lines = ["Fachliche Restore-Pruefungen:"];
  for (const check of report.checks) {
    lines.push(`  [${check.passed ? "OK" : "FEHLER"}] ${check.name}: ${check.actual} (erwartet ${check.expectation})`);
    if (!check.passed) lines.push(`         ${check.description}`);
  }
  lines.push("Bestand:");
  for (const entry of report.inventory) {
    const comparison =
      entry.matches === null ? "ohne Vergleichswert" : entry.matches ? "wie erwartet" : `erwartet ${entry.expected}`;
    lines.push(`  ${entry.table}: ${entry.actual} (${comparison})`);
  }
  return lines.join("\n");
}

module.exports = { CHECKS, INVENTORY_TABLES, formatReport, readInventory, runRestoreContractChecks };
