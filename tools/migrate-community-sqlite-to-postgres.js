#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const { PostgresCommunityRepository } = require("../services/community-platform/src/repositories/postgres-community-repository");

const TABLES = {
  community_questions: "questions",
  community_answers: "answers",
  community_knowledge_documents: "knowledgeDocuments",
};

function readLegacyCommunityState(sqlitePath) {
  const state = { questions: [], answers: [], knowledgeDocuments: [] };
  if (!sqlitePath || !fs.existsSync(sqlitePath)) return state;
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    for (const [table, collection] of Object.entries(TABLES)) {
      if (!tableExists(db, table)) continue;
      state[collection] = db.prepare(`SELECT raw_json FROM ${table} ORDER BY rowid`)
        .all().map((row) => JSON.parse(row.raw_json));
    }
    if (Object.values(state).some((items) => items.length > 0) || !tableExists(db, "service_documents")) {
      return state;
    }
    const mapping = {
      questions: "questions",
      answers: "answers",
      knowledge_documents: "knowledgeDocuments",
    };
    for (const row of db.prepare(`
      SELECT collection_name, document_json
      FROM service_documents
      WHERE service_key='community-platform'
      ORDER BY collection_name, document_id
    `).all()) {
      if (mapping[row.collection_name]) state[mapping[row.collection_name]].push(JSON.parse(row.document_json));
    }
    return state;
  } finally {
    db.close();
  }
}

function tableExists(db, table) {
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
  ).get(table));
}

async function main() {
  const sqlitePath = process.env.COMMUNITY_SQLITE_PATH
    || "/var/lib/gernetix/community/gernetix-community.sqlite";
  const repository = await PostgresCommunityRepository.create({
    poolOptions: {
      connectionString: process.env.COMMUNITY_POSTGRES_URL || undefined,
      host: process.env.COMMUNITY_POSTGRES_HOST || "community-postgres",
      port: Number(process.env.COMMUNITY_POSTGRES_PORT || 5432),
      database: process.env.COMMUNITY_POSTGRES_DATABASE || "gernetix_community",
      user: process.env.COMMUNITY_POSTGRES_USER || "gernetix_community",
      password: requiredSecret(process.env.COMMUNITY_POSTGRES_PASSWORD),
    },
  });
  try {
    const result = await repository.importLegacyState(readLegacyCommunityState(sqlitePath));
    process.stdout.write(`${JSON.stringify({ sqlite_path: sqlitePath, ...result })}\n`);
  } finally {
    await repository.close();
  }
}

function requiredSecret(value) {
  if (!String(value || "").trim()) throw new Error("COMMUNITY_POSTGRES_PASSWORD fehlt.");
  return value;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Community-Migration fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { readLegacyCommunityState, requiredSecret };
