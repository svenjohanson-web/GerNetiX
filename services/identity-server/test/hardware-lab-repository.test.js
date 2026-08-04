const assert = require("node:assert/strict");
const test = require("node:test");
const { PostgresHardwareLabRepository } = require("../src/dev/hardware-lab-repository");

test("hydrates and persists hardware-lab sessions through the Identity PostgreSQL state boundary", async () => {
  const writes = [];
  const stateStore = {
    load: () => ({ sessions: [{ recovery_session_id: "lab-existing", account_id: "acct-owner" }] }),
    async save(state) { writes.push(structuredClone(state)); },
  };
  const repository = new PostgresHardwareLabRepository(stateStore);
  repository.hydrate();
  repository.saveSession({ recovery_session_id: "lab-new", account_id: "acct-owner" });
  await repository.flush();

  assert.equal(repository.findSession("lab-existing").account_id, "acct-owner");
  assert.deepEqual(writes.at(-1).sessions.map((session) => session.recovery_session_id), ["lab-existing", "lab-new"]);
});
