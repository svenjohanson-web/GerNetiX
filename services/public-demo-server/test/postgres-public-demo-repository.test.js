const assert = require("node:assert/strict");
const test = require("node:test");
const { PostgresPublicDemoRepository } = require("../src/repositories/postgres-public-demo-repository");

function createRepository() {
  const catalogInserts = [];
  const client = {
    query(sql, params) {
      if (String(sql).includes("INSERT INTO public_demo_catalog")) catalogInserts.push(params);
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    connect: async () => client,
    query: async (sql) => (String(sql).includes("FROM public_demo_catalog")
      ? { rows: [{ demo_id: "touch-spielesammlung", title: "t", description: "d", board_hardware_item_id: "b", category: "spiele", games_json: ["nibbles", "frogger"], published_at: "2026-08-19" }] }
      : { rows: [] }),
  };
  const artifactStore = { put: async () => ({ object_key: "key", sha256: "a".repeat(64) }) };
  return { repository: new PostgresPublicDemoRepository(pool, artifactStore), catalogInserts };
}

function release(overrides = {}) {
  return {
    demo_id: "touch-spielesammlung",
    title: "Touch-Spielesammlung",
    description: "Beschreibung",
    board_hardware_item_id: "hardware.processor_board.esp32_s3_es3c28p",
    category: "spiele",
    games: ["nibbles", "frogger"],
    version: "1.0.0",
    firmware_file_name: "firmware.bin",
    source_path: "gernetix-products/spielesammlung-esp32-s3-touch",
    source_commit_sha: "0123456789abcdef0123456789abcdef01234567",
    bootloader_base64: Buffer.from([0xe9, 0x00]).toString("base64"),
    partitions_base64: Buffer.from([0xaa, 0x55]).toString("base64"),
    firmware_base64: Buffer.from([0xe9, 0x01, 0x02, 0x03]).toString("base64"),
    ...overrides,
  };
}

test("die Spieleliste wird als JSON-Text in die JSONB-Spalte geschrieben", async () => {
  const { repository, catalogInserts } = createRepository();
  await repository.publish(release());

  assert.equal(catalogInserts.length, 1);
  const games = catalogInserts[0][5];
  // Ein JS-Array wuerde vom Treiber als Postgres-Array-Literal gesendet und von
  // JSONB mit 22P02 abgelehnt. Nur ein JSON-Text ist ein gueltiger Parameter.
  assert.equal(typeof games, "string");
  assert.deepEqual(JSON.parse(games), ["nibbles", "frogger"]);
});

test("auch eine leere Spieleliste bleibt gueltiges JSON", async () => {
  const { repository, catalogInserts } = createRepository();
  await repository.publish(release({ games: [] }));

  const games = catalogInserts[0][5];
  assert.equal(typeof games, "string");
  assert.deepEqual(JSON.parse(games), []);
});
