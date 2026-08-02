"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const remoteDeploy = fs.readFileSync(path.join(repoRoot, "scripts/staging/remote-deploy.sh"), "utf8");
const dockerfile = fs.readFileSync(path.join(repoRoot, "docker/node-service.Dockerfile"), "utf8");

test("classifies service-only changes for a targeted staging deployment", () => {
  assert.match(remoteDeploy, /git diff --name-only "\$previous_commit" HEAD/);
  assert.match(remoteDeploy, /services\/identity-server\/\*\) add_incremental_service identity-server/);
  assert.match(remoteDeploy, /services\/project-server\/\*\) add_incremental_service project-server/);
  assert.match(remoteDeploy, /services\/compute-control-plane\/\*\) add_incremental_service compute-control-plane/);
  assert.match(remoteDeploy, /\*\) deploy_mode=full; break/);
  assert.match(remoteDeploy, /compose build "\$build_service"/);
  assert.match(remoteDeploy, /compose up -d --no-deps --force-recreate \$incremental_services/);
});

test("uses targeted health checks for incremental changes and keeps the full safety path", () => {
  assert.match(remoteDeploy, /docker exec "\$container_id" node \/app\/docker\/healthcheck\.js/);
  assert.match(remoteDeploy, /GERNETIX_STAGING_INCREMENTAL_WAIT_TIMEOUT:-45/);
  assert.match(remoteDeploy, /\*" identity-server "\*\)[\s\S]*wait_for_private_pwa/);
  assert.match(remoteDeploy, /nft -c -f infra\/vps\/security\/firewall\.nft/);
  assert.match(remoteDeploy, /up -d --wait --wait-timeout "\$wait_timeout"/);
  assert.match(remoteDeploy, /postgres-consolidation-migration/);
  assert.match(remoteDeploy, /--force-recreate build-router nginx/);
});

test("keeps npm installs cached when only service source files change", () => {
  const dependencyManifest = dockerfile.indexOf("services/identity-server/package-lock.json");
  const dependencyInstall = dockerfile.indexOf("npm ci --omit=dev --prefix services/identity-server");
  const serviceSources = dockerfile.indexOf("COPY --chown=node:node services ./services");
  const runtimeVerification = dockerfile.indexOf("npm run verify:runtime-deps");

  assert.ok(dependencyManifest >= 0);
  assert.ok(dependencyManifest < dependencyInstall);
  assert.ok(dependencyInstall < serviceSources);
  assert.ok(serviceSources < runtimeVerification);
});

test("rejects a public wildcard binding for the Compute Worker Gateway", () => {
  assert.match(remoteDeploy, /COMPUTE_BIND_ADDRESS/);
  assert.match(remoteDeploy, /compute_bind_address.*0\.0\.0\.0/);
  assert.match(remoteDeploy, /COMPUTE_BIND_ADDRESS darf keinen oeffentlichen Wildcard-Listener verwenden/);
});
