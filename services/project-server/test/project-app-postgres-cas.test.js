const assert = require("node:assert/strict");
const test = require("node:test");

const { PostgresProjectRepository } = require("../src/repositories/postgres-project-repository");

test("PostgreSQL project app CAS can update revisions greater than zero", async () => {
  let capturedQuery = "";
  let capturedValues = [];
  const repository = Object.create(PostgresProjectRepository.prototype);
  repository.pool = {
    async query(query, values) {
      capturedQuery = query;
      capturedValues = values;
      return { rowCount: 1, rows: [{ raw_json: values[4] }] };
    },
  };
  const settings = {
    project_id: "project-1",
    account_id: "account-1",
    manifest_version: 1,
    revision: 2,
    values: { web_search_enabled: true },
    created_at: "2026-08-04T14:00:00.000Z",
    updated_at: "2026-08-04T14:01:00.000Z",
  };

  const result = await repository.compareAndSetProjectAppSettings(settings, 1);

  assert.equal(result.saved, true);
  assert.equal(result.value.revision, 2);
  assert.match(capturedQuery, /UPDATE project_app_settings SET/);
  assert.match(capturedQuery, /revision=\$8/);
  assert.match(capturedQuery, /WHERE \$8=0 AND NOT EXISTS/);
  assert.equal(capturedValues[7], 1);
});
