"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { resolveIdentityRuntimePersistence } = require("../src/runtime-persistence-policy");

test("defaults the Identity runtime to PostgreSQL", () => {
  assert.equal(resolveIdentityRuntimePersistence({ IDENTITY_RUNTIME_LOCATION: "server" }), "postgres");
});

test("accepts explicit PostgreSQL runtime configuration", () => {
  assert.equal(resolveIdentityRuntimePersistence({
    IDENTITY_RUNTIME_LOCATION: "server",
    IDENTITY_PERSISTENCE_BACKEND: "postgresql",
  }), "postgres");
});

test("rejects SQLite for every Identity runtime start", () => {
  assert.throws(
    () => resolveIdentityRuntimePersistence({
      IDENTITY_RUNTIME_LOCATION: "server",
      IDENTITY_PERSISTENCE_BACKEND: "sqlite",
    }),
    /ausschliesslich PostgreSQL/,
  );
});

test("rejects a local Identity process even when it targets PostgreSQL", () => {
  assert.throws(
    () => resolveIdentityRuntimePersistence({ IDENTITY_PERSISTENCE_BACKEND: "postgres" }),
    /nur als kanonischer Serverdienst/,
  );
});
