#!/usr/bin/env node
"use strict";

const { ForgejoClient } = require("../services/project-server/src/repository-store/forgejo-client");
const { SYSTEM_REPOSITORY_DEFINITIONS } = require("../services/project-server/src/system-repository-catalog");

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument !== "--username") throw new Error(`Unbekanntes Argument: ${argument}`);
    result.username = argv[index + 1];
    index += 1;
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,39}$/.test(String(result.username || ""))) {
    throw new Error("forgejo_developer_username_invalid");
  }
  return result;
}

async function grantDeveloperAccess({ username, client }) {
  const repositories = [];
  for (const definition of SYSTEM_REPOSITORY_DEFINITIONS) {
    const repository = await client.getRepository(definition.organization, definition.repository_name);
    if (!repository) throw new Error(`forgejo_system_repository_missing:${definition.organization}/${definition.repository_name}`);
    await client.addRepositoryCollaborator(definition.organization, definition.repository_name, username, "write");
    repositories.push({
      source_id: definition.source_id,
      title: definition.title,
      organization: definition.organization,
      repository_name: definition.repository_name,
      local_directory: definition.local_directory || definition.repository_name,
      default_branch: String(repository.default_branch || "main"),
    });
  }
  return repositories;
}

async function main() {
  const { username } = parseArgs(process.argv.slice(2));
  const baseUrl = String(process.env.FORGEJO_INTERNAL_URL || "").trim();
  const token = String(process.env.FORGEJO_PROVISION_TOKEN || "").trim();
  if (!baseUrl || !token) throw new Error("forgejo_provision_configuration_missing");
  const repositories = await grantDeveloperAccess({ username, client: new ForgejoClient({ baseUrl, token }) });
  process.stdout.write(`${JSON.stringify({ username, repositories })}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { grantDeveloperAccess, parseArgs };
