"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  REQUIRED_AREAS,
  createManifest,
  isJointlyConsistentRestorePoint,
  parseManifest,
  serializeManifest,
} = require("./backup-manifest");

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function member(overrides = {}) {
  return {
    name: "runtime-database.dump",
    area: "runtime_database",
    consistency: "transactional_dump",
    sha256: HASH_A,
    sizeBytes: 4096,
    encryptedSha256: HASH_B,
    encryptedSizeBytes: 4300,
    ...overrides,
  };
}

function completeMembers(mode) {
  const forgejoConsistency = mode === "daily" ? "stopped_service_snapshot" : "online_snapshot";
  return [
    member(),
    member({ name: "forgejo-database.dump", area: "forgejo_database", consistency: forgejoConsistency }),
    member({ name: "forgejo-data.tar.gz", area: "forgejo_data", consistency: forgejoConsistency }),
    member({ name: "artifact-objects.tar", area: "artifact_store", consistency: "content_addressed" }),
  ];
}

function input(overrides = {}) {
  const mode = overrides.mode || "hourly";
  return {
    backupId: `20260820T101500Z-${mode}-${"0123456789abcdef"}`,
    createdAt: "2026-08-20T10:15:00.000Z",
    mode,
    sourceInstance: "gernetix-vps",
    applicationVersion: "2026.08.20",
    schemaVersions: { gernetix_runtime: "0421", forgejo: "15.0.6" },
    forgejoVersion: "15.0.6",
    recoveryKeyId: HASH_A,
    members: completeMembers(mode),
    ...overrides,
  };
}

test("nimmt einen vollstaendigen Sicherungssatz an und sortiert ihn stabil", () => {
  const manifest = createManifest(input());
  assert.equal(manifest.manifest_version, 1);
  assert.deepEqual(
    manifest.members.map((entry) => entry.name),
    ["artifact-objects.tar", "forgejo-data.tar.gz", "forgejo-database.dump", "runtime-database.dump"],
  );
  assert.equal(serializeManifest(manifest), serializeManifest(createManifest(input())));
});

test("verlangt jeden Pflichtbereich", () => {
  for (const area of REQUIRED_AREAS) {
    const members = completeMembers("hourly").filter((entry) => entry.area !== area);
    assert.throws(() => createManifest(input({ members })), new RegExp(area));
  }
});

test("kennzeichnet den Forgejo-Rhythmus im Satz selbst", () => {
  assert.equal(createManifest(input({ mode: "hourly" })).forgejo_consistency, "online_snapshot");
  assert.equal(createManifest(input({ mode: "daily" })).forgejo_consistency, "stopped_service_snapshot");
});

test("nur der taegliche Satz gilt als gemeinsam konsistenter Wiederherstellungspunkt", () => {
  assert.equal(isJointlyConsistentRestorePoint(createManifest(input({ mode: "daily" }))), true);
  assert.equal(isJointlyConsistentRestorePoint(createManifest(input({ mode: "hourly" }))), false);
});

test("weist einen Satz ab, der eine falsche Konsistenz behauptet", () => {
  const members = completeMembers("daily").map((entry) =>
    entry.area === "forgejo_data" ? { ...entry, consistency: "online_snapshot" } : entry,
  );
  assert.throws(
    () => createManifest(input({ mode: "daily", members })),
    /forgejo-data\.tar\.gz ist als online_snapshot gesichert/,
  );
});

test("weist doppelte Bestandteile und unbekannte Bereiche ab", () => {
  const duplicated = [...completeMembers("hourly"), member()];
  assert.throws(() => createManifest(input({ members: duplicated })), /doppelt im Manifest/);
  const unknown = [...completeMembers("hourly"), member({ name: "sonstiges.bin", area: "browser_cache" })];
  assert.throws(() => createManifest(input({ members: unknown })), /Unbekannter Datenbereich/);
});

test("weist Bestandteilnamen mit Pfadanteilen ab", () => {
  for (const name of ["../fluchtweg", "unter/verzeichnis", "/absolut", "Gross.dump", ""]) {
    const members = [...completeMembers("hourly").slice(1), member({ name })];
    assert.throws(() => createManifest(input({ members })), /nicht zulaessig|Pflichtbereiche/);
  }
});

test("verlangt vollstaendige Pruefsummen und Groessen fuer Klartext und Objekt", () => {
  const cases = [
    { sha256: "kurz" },
    { encryptedSha256: "kurz" },
    { sizeBytes: -1 },
    { encryptedSizeBytes: 1.5 },
    { sizeBytes: undefined },
  ];
  for (const override of cases) {
    const members = [member(override), ...completeMembers("hourly").slice(1)];
    assert.throws(() => createManifest(input({ members })), /SHA-256-Wert|Byte-Angabe/);
  }
});

test("verlangt Backup-ID, Zeitstempel, Modus und Recovery-Key-ID in fester Form", () => {
  assert.throws(() => createManifest(input({ backupId: "backup-1" })), /Backup-ID/);
  assert.throws(() => createManifest(input({ createdAt: "2026-08-20 10:15" })), /ISO 8601/);
  const validId = "20260820T101500Z-hourly-0123456789abcdef";
  assert.throws(() => createManifest(input({ mode: "weekly", backupId: validId })), /Unbekannter Sicherungsmodus/);
  assert.throws(
    () => createManifest(input({ mode: "daily", backupId: validId, members: completeMembers("daily") })),
    /nennt nicht den Sicherungsmodus daily/,
  );
  assert.throws(() => createManifest(input({ recoveryKeyId: "unbekannt" })), /Recovery-Key-ID/);
  assert.throws(() => createManifest(input({ schemaVersions: {} })), /mindestens eine Schemaversion/);
});

test("fuehrt uebernommene Artefakte mit dem Satz, der sie haelt", () => {
  const manifest = createManifest(
    input({
      carriedForwardArtifacts: [
        { sha256: HASH_B, backupId: "20260820T091500Z-hourly-0123456789abcdef" },
        { sha256: HASH_A, backupId: "20260819T091500Z-daily-0123456789abcdef" },
      ],
    }),
  );
  assert.deepEqual(
    manifest.carried_forward_artifacts.map((entry) => entry.sha256),
    [HASH_A, HASH_B],
  );
  assert.throws(
    () => createManifest(input({ carriedForwardArtifacts: [{ sha256: HASH_A, backupId: "unklar" }] })),
    /Backup-ID/,
  );
  assert.throws(
    () =>
      createManifest(
        input({
          carriedForwardArtifacts: [
            { sha256: HASH_A, backupId: "20260820T091500Z-hourly-0123456789abcdef" },
            { sha256: HASH_A, backupId: "20260819T091500Z-daily-0123456789abcdef" },
          ],
        }),
      ),
    /doppelt gelistet/,
  );
});

test("liest ein serialisiertes Manifest verlustfrei zurueck", () => {
  const manifest = createManifest(input({ mode: "daily" }));
  assert.deepEqual(parseManifest(serializeManifest(manifest)), manifest);
});

test("weist beschaedigte und fremde Manifeste ab", () => {
  assert.throws(() => parseManifest("kein json"), /gueltiges JSON/);
  assert.throws(() => parseManifest(JSON.stringify({ manifest_version: 2 })), /Nicht unterstuetzte Manifestversion/);
  const tampered = JSON.parse(serializeManifest(createManifest(input())));
  tampered.members[0].sha256 = "0".repeat(63);
  assert.throws(() => parseManifest(JSON.stringify(tampered)), /SHA-256-Wert/);
});
