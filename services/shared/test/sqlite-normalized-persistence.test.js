const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");

const { SqliteStateStore } = require("../index");
const { SqliteBackedIdentityRepository } = require("../../identity-server/src/repositories/sqlite-backed-identity-repository");
const { SqliteBackedAiUsageRepository } = require("../../ai-usage-server/src/repositories/sqlite-backed-ai-usage-repository");
const { SqliteBackedHardwareShopRepository } = require("../../hardware-shop/src/repositories/sqlite-backed-hardware-shop-repository");
const { SqliteBackedAdminRepository } = require("../../admin-tool/src/repositories/sqlite-backed-admin-repository");
const { SqliteBackedProvisioningRepository } = require("../../provisioning-tool/src/repositories/sqlite-backed-provisioning-repository");
const { SqliteBackedCommunityRepository } = require("../../community-platform/src/repositories/sqlite-backed-community-repository");
const { SqliteBackedCommunityAiRepository } = require("../../community-ai-assistant/src/repositories/sqlite-backed-community-ai-repository");
const { SqliteBackedRecoveryRepository } = require("../../recovery-tool/src/repositories/sqlite-backed-recovery-repository");
const { BuildDeployService } = require("../../build-deploy-server/src/services/build-deploy-service");

test("remaining services write normalized sqlite tables", () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-normalized-sqlite-")), "state.sqlite");

  const identity = SqliteBackedIdentityRepository.create(dbPath);
  const account = identity.createUserAccount({ username: "sven", email: "sven@example.test", status: "active" });
  identity.createLocalCredential({ userId: account.id, passwordHash: "hash" });

  const aiUsage = SqliteBackedAiUsageRepository.create(dbPath);
  aiUsage.saveCreditAccount({
    account_id: "acct-1",
    plan_id: "plan.premium",
    total_granted_credits: 20,
    consumed_credits: 0,
    held_credits: 0,
    blocked_until: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  });
  aiUsage.addUsageEvent({
    event_id: "usage-1",
    account_id: "acct-1",
    model: "gpt-4.1-mini",
    status: "success",
    calculated_credits: 1,
    created_at: "2026-01-01T00:00:00.000Z",
  });

  const hardwareShop = SqliteBackedHardwareShopRepository.create(dbPath);
  hardwareShop.saveCart({
    cart_id: "cart-1",
    account_id: "acct-1",
    status: "open",
    items: [{ offer_id: "offer.esp32_starter_board", quantity: 1 }],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  });

  const admin = SqliteBackedAdminRepository.create(dbPath);
  admin.createConsent({
    account_id: "acct-1",
    granted_to_role: "support",
    purpose: "support_case",
    valid_until: "2099-01-01T00:00:00.000Z",
  });

  const provisioning = SqliteBackedProvisioningRepository.create(dbPath);
  provisioning.saveSession({
    session_id: "prov-1",
    status: "created",
    device: { device_id: "device-1", serial_number: "GNX-001" },
    credential: { credential_id: "cred-1" },
    audit_events: [],
  });

  const community = SqliteBackedCommunityRepository.create(dbPath);
  community.saveQuestion({
    question_id: "question-1",
    account_id: "acct-1",
    title: "OTA?",
    body: "Wie geht OTA?",
    status: "open",
    triage_status: "new",
    tags: ["ota"],
  });

  const communityAi = SqliteBackedCommunityAiRepository.create(dbPath);
  communityAi.saveQuery({
    query_id: "query-1",
    account_id: "acct-1",
    question: "Hilf mir",
    answer: "Gern",
    status: "answered",
    source_documents: [],
    usage_event_id: "usage-1",
    created_at: "2026-01-01T00:00:00.000Z",
  });

  const recovery = SqliteBackedRecoveryRepository.create(dbPath);
  recovery.saveSession({
    recovery_session_id: "recovery-1",
    account_id: "acct-1",
    device_id: "device-1",
    status: "open",
    recovery_type: "usb",
    detected_board: {},
    capabilities: [],
    steps: [],
  });

  const buildDeployStore = new SqliteStateStore(dbPath, "build-deploy-server", { defaultState: { jobs: [] } });
  const buildDeploy = new BuildDeployService({
    cache: {},
    packageStore: {},
    runner: {},
    artifactStore: {},
    deployOrchestrator: {},
    deviceJobLock: {},
    stateStore: buildDeployStore,
  });
  buildDeploy.jobs.set("build-1", {
    job_id: "build-1",
    mode: "build",
    device_id: "device-1",
    status: "succeeded",
    created_at: "2026-01-01T00:00:00.000Z",
  });
  buildDeploy.persistJobs();

  const db = new DatabaseSync(dbPath);
  assert.equal(tableCount(db, "identity_user_accounts"), 1);
  assert.equal(tableCount(db, "ai_usage_events"), 1);
  assert.equal(tableCount(db, "hardware_shop_carts"), 1);
  assert.equal(tableCount(db, "admin_tool_consents"), 1);
  assert.equal(tableCount(db, "provisioning_sessions"), 1);
  assert.equal(tableCount(db, "community_questions"), 1);
  assert.equal(tableCount(db, "community_ai_queries"), 1);
  assert.equal(tableCount(db, "recovery_sessions"), 1);
  assert.equal(tableCount(db, "build_deploy_jobs"), 1);
  db.close();
});

function tableCount(db, tableName) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
}
