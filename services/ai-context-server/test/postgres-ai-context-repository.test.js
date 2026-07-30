const assert = require("node:assert/strict");
const test = require("node:test");

const { createConfig } = require("../src/config");
const {
  startAiContextBackgroundInitialization,
} = require("../src");
const { PostgresAiContextRepository } = require("../src/repositories/postgres-ai-context-repository");

test("PostgreSQL configuration keeps credentials separate from the connection URL", () => {
  const config = createConfig({
    AI_CONTEXT_POSTGRES_HOST: "postgres.internal",
    AI_CONTEXT_POSTGRES_PORT: "5544",
    AI_CONTEXT_POSTGRES_DATABASE: "context",
    AI_CONTEXT_POSTGRES_USER: "context_user",
    AI_CONTEXT_POSTGRES_PASSWORD: "special:@/password",
  });

  assert.deepEqual(config.postgres, {
    connectionString: "",
    host: "postgres.internal",
    port: 5544,
    database: "context",
    user: "context_user",
    password: "special:@/password",
  });
});

test("repository initializes pgvector and uses vector similarity search", async () => {
  const queries = [];
  const pool = createPoolStub(queries);
  const embedding = Array(768).fill(0);
  embedding[0] = 1;
  const repository = await PostgresAiContextRepository.create({
    pool,
    dimensions: 768,
    embeddingClient: { model: "test-embedding", embed: async () => embedding },
  });

  const grant = {
    grant_id: "grant_test",
    account_id: "account_test",
    source_type: "architecture_context",
    purpose: "architecture_assistance",
    valid_from: "2026-07-13T10:00:00.000Z",
    valid_until: "2026-07-14T10:00:00.000Z",
    created_at: "2026-07-13T10:00:00.000Z",
  };
  await repository.saveGrant(grant);
  await repository.saveIntentExample({example_id:"intent-1",utterance:"noch ein Board",intent:"architecture.add_component",entity:"ESP32",scope:"account",account_id:"acct-1",status:"active",updated_at:grant.created_at});
  await repository.searchIntentExamples("noch ein Board",3,"acct-1");
  const result = await repository.searchArchitectureComponents("adaptive architecture", 3);

  assert.ok(queries.some(({ sql }) => sql.includes("CREATE EXTENSION IF NOT EXISTS vector")));
  assert.ok(queries.some(({ sql }) => sql.includes("USING hnsw")));
  assert.ok(queries.some(({ sql }) => sql.includes("ADD COLUMN IF NOT EXISTS account_id")));
  assert.ok(queries.some(({ sql }) => sql.includes("embedding vector(768)")));
  assert.ok(queries.some(({ sql }) => sql.includes("embedding <=> $1::vector")));
  assert.ok(queries.some(({ sql }) => sql.includes("scope='global' OR account_id=$3")));
  const intentInsert = queries.find(({ sql }) => sql.includes("INSERT INTO ai_context_intent_examples"));
  assert.equal(intentInsert.params[4], "acct-1");
  const grantInsert = queries.find(({ sql }) => sql.includes("INSERT INTO ai_context_grants"));
  assert.equal(grantInsert.params[8], grant.created_at);
  assert.equal(result.strategy, "pgvector");
  assert.equal(result.items[0].component_id, "component.semantic_test");
  assert.equal(result.items[0].semantic_score, 0.91);
});

test("repository startup seeds defaults without waiting for embedding calls", async () => {
  const queries = [];
  let embeddingCalls = 0;
  await PostgresAiContextRepository.create({
    pool: createPoolStub(queries),
    dimensions: 768,
    embeddingClient: {
      model: "test-embedding",
      embed: async () => {
        embeddingCalls += 1;
        return Array(768).fill(0);
      },
    },
  });

  assert.equal(embeddingCalls, 0);
  const componentInsert = queries.find(({ sql }) => sql.includes("INSERT INTO ai_context_architecture_components"));
  const articleInsert = queries.find(({ sql }) => sql.includes("INSERT INTO ai_context_help_articles"));
  assert.equal(componentInsert.params[4], null);
  assert.equal(articleInsert.params[4], null);
});

test("background embedding backfill stops after the first provider failure", async () => {
  let embeddingCalls = 0;
  const repository = new PostgresAiContextRepository({
    pool: {
      query: async (sql) => {
        if (sql.includes("FROM ai_context_architecture_components")) {
          return {
            rows: [
              { item_id:"component-1", raw_json:{ name:"Component 1" } },
              { item_id:"component-2", raw_json:{ name:"Component 2" } },
            ],
          };
        }
        return { rows:[] };
      },
    },
    embeddingClient: {
      embed: async () => {
        embeddingCalls += 1;
        throw new Error("provider timeout");
      },
    },
  });
  const warnings = [];

  const result = await startAiContextBackgroundInitialization(repositoryService(repository), {
    log() {},
    warn(message) { warnings.push(message); },
  });

  assert.deepEqual(result, {
    completed:false,
    updated:0,
    reason:"provider timeout",
  });
  assert.equal(embeddingCalls, 1);
  assert.deepEqual(warnings, ["AI Context Embedding-Backfill pausiert: provider timeout"]);
});

test("background embedding backfill updates missing vectors", async () => {
  const queries = [];
  const embedding = Array(768).fill(0);
  embedding[0] = 1;
  const repository = new PostgresAiContextRepository({
    pool: {
      query: async (sql, params = []) => {
        queries.push({ sql, params });
        if (sql.includes("FROM ai_context_architecture_components")) {
          return { rows:[{ item_id:"component-1", raw_json:{ name:"Component 1" } }] };
        }
        if (sql.includes("FROM ai_context_help_articles")) return { rows:[] };
        return { rows:[] };
      },
    },
    embeddingClient: { embed: async () => embedding },
  });

  const result = await repository.backfillMissingEmbeddings();

  assert.deepEqual(result, { completed:true, updated:1 });
  const update = queries.find(({ sql }) => sql.includes("UPDATE ai_context_architecture_components"));
  assert.equal(update.params[1], "component-1");
  assert.match(update.params[0], /^\[1,0,/);
});

function repositoryService(repository) {
  return { repository };
}

function createPoolStub(queries) {
  const query = async (sql, params = []) => {
    queries.push({ sql, params });
    if (sql.includes("SELECT raw_json, 1-(embedding")) {
      return {
        rowCount: 1,
        rows: [{
          raw_json: { component_id: "component.semantic_test", name: "Semantic Test" },
          score: "0.91",
        }],
      };
    }
    return { rowCount: 0, rows: [] };
  };
  return {
    connect: async () => ({ query, release() {} }),
    query,
    end: async () => {},
  };
}
