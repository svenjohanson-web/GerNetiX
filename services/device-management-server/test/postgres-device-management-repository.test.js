const assert = require("node:assert/strict");
const test = require("node:test");
const {
  PostgresDeviceManagementRepository,
} = require("../src/repositories/postgres-device-management-repository");

test("creates normalized Device Management PostgreSQL tables", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresDeviceManagementRepository(pool);
  await repository.ensureSchema();
  assert.match(pool.calls[0].text, /device_management_devices/);
  assert.match(pool.calls[0].text, /device_management_account_devices/);
  assert.match(pool.calls[0].text, /device_management_account_board_versions/);
  assert.match(pool.calls[0].text, /device_management_provisioning_tokens/);
  assert.match(pool.calls[0].text, /device_management_audit_events/);
  assert.match(pool.calls[0].text, /device_management_migrations/);
});

test("resolves account ownership without process-local maps", async () => {
  const pool = new RecordingPool([{ account_id: "acct-1" }, { account_id: "acct-2" }]);
  const repository = new PostgresDeviceManagementRepository(pool);
  assert.deepEqual(await repository.findAccountIdsByDeviceId("device-1"), ["acct-1", "acct-2"]);
  assert.match(pool.calls[0].text, /SELECT DISTINCT account_id/);
});

class RecordingPool {
  constructor(rows = []) {
    this.rows = rows;
    this.calls = [];
  }
  async query(text, values = []) {
    this.calls.push({ text, values });
    return { rows: this.rows, rowCount: this.rows.length };
  }
}
