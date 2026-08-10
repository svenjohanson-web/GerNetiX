"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { SYSTEM_REPOSITORY_DEFINITIONS } = require("../services/project-server/src/system-repository-catalog");
const { grantDeveloperAccess, parseArgs } = require("./provision-forgejo-developer-access");

test("accepts only a bounded Forgejo developer username", () => {
  assert.equal(parseArgs(["--username", "sven"]).username, "sven");
  assert.throws(() => parseArgs(["--username", "../admin"]), /username_invalid/);
  assert.throws(() => parseArgs(["--token", "secret"]), /Unbekanntes Argument/);
});

test("grants write access to every protected system repository", async () => {
  const grants = [];
  const client = {
    getRepository: async (organization, repositoryName) => ({ default_branch: "main", organization, repositoryName }),
    addRepositoryCollaborator: async (organization, repositoryName, username, permission) => {
      grants.push({ organization, repositoryName, username, permission });
    },
  };

  const repositories = await grantDeveloperAccess({ username: "sven", client });

  assert.equal(repositories.length, SYSTEM_REPOSITORY_DEFINITIONS.length);
  assert.equal(grants.length, SYSTEM_REPOSITORY_DEFINITIONS.length);
  assert.ok(grants.every((grant) => grant.username === "sven" && grant.permission === "write"));
});
