"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const remoteDeploy = fs.readFileSync(path.join(repoRoot, "scripts/staging/remote-deploy.sh"), "utf8");
const dockerfile = fs.readFileSync(path.join(repoRoot, "docker/node-service.Dockerfile"), "utf8");
const identityDockerfile = fs.readFileSync(path.join(repoRoot, "docker/identity-service.Dockerfile"), "utf8");
const composeFile = fs.readFileSync(path.join(repoRoot, "compose.vps.yaml"), "utf8");
const dockerignore = fs.readFileSync(path.join(repoRoot, ".dockerignore"), "utf8");

test("classifies service-only changes for a targeted staging deployment", () => {
  assert.match(remoteDeploy, /git diff --name-only "\$previous_commit" HEAD/);
  assert.match(remoteDeploy, /services\/identity-server\/\*\) add_incremental_service identity-server/);
  assert.match(remoteDeploy, /services\/project-server\/\*\) add_incremental_service project-server/);
  assert.match(remoteDeploy, /services\/compute-control-plane\/\*\) add_incremental_service compute-control-plane/);
  assert.match(remoteDeploy, /services\/recovery-tool\/\*\) add_incremental_service identity-server/);
  assert.match(remoteDeploy, /services\/device-voice-orchestrator\/\*\) add_incremental_service device-voice-orchestrator/);
  assert.match(remoteDeploy, /\*\)[\s\S]*deploy_mode=full[\s\S]*break/);
  assert.match(remoteDeploy, /compose build identity-server/);
  assert.match(remoteDeploy, /compose build "\$shared_build_service"/);
  assert.match(remoteDeploy, /compose up -d --no-deps --force-recreate \$incremental_services/);
});

test("uses targeted health checks and recreates the stateless edge for fresh bind mounts", () => {
  assert.match(remoteDeploy, /docker exec "\$container_id" node \/app\/docker\/healthcheck\.js/);
  assert.match(remoteDeploy, /GERNETIX_STAGING_INCREMENTAL_WAIT_TIMEOUT:-45/);
  assert.match(remoteDeploy, /\*" identity-server "\*\)[\s\S]*edge_changed=1/);
  assert.match(remoteDeploy, /if \[ "\$edge_changed" -eq 1 \]; then[\s\S]*reload_edge/);
  assert.match(remoteDeploy, /infra\/vps\/nginx\/\*\)[\s\S]*edge_changed=1/);
  assert.match(remoteDeploy, /deploy_mode=targeted-infrastructure/);
  assert.match(remoteDeploy, /compose --profile tls up -d --no-deps --force-recreate nginx nginx-tls/);
  assert.match(remoteDeploy, /docker exec "\$nginx_tls_container" nginx -t/);
  assert.doesNotMatch(remoteDeploy, /docker exec "\$nginx_tls_container" nginx -s reload/);
});

test("serializes deployments and avoids recurring full-path work", () => {
  assert.match(remoteDeploy, /flock -n 9/);
  assert.match(remoteDeploy, /Ein anderes Staging-Deployment laeuft bereits/);
  assert.match(remoteDeploy, /nft -c -f infra\/vps\/security\/firewall\.nft/);
  assert.match(remoteDeploy, /up -d --wait --wait-timeout "\$wait_timeout"/);
  assert.match(remoteDeploy, /legacy_consolidation_required/);
  assert.match(remoteDeploy, /Keine Legacy-PostgreSQL-Container: Konsolidierung uebersprungen/);
  assert.match(remoteDeploy, /HTTPS-Zertifikate vorhanden: Ausstellung uebersprungen/);
  assert.doesNotMatch(remoteDeploy, /force-recreate runtime-postgres/);
  assert.match(remoteDeploy, /--force-recreate build-router/);
  assert.match(remoteDeploy, /Deployment beendet: Status \$deploy_status, Dauer/);
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

test("builds frequent identity changes in a dedicated small runtime image", () => {
  const dependencyManifest = identityDockerfile.indexOf("services/identity-server/package-lock.json");
  const dependencyInstall = identityDockerfile.indexOf("npm ci --include=dev --prefix services/identity-server");
  const identitySources = identityDockerfile.indexOf("COPY --chown=node:node services/identity-server ./services/identity-server");
  assert.ok(dependencyManifest >= 0);
  assert.ok(dependencyManifest < dependencyInstall);
  assert.ok(dependencyInstall < identitySources);
  assert.match(identityDockerfile, /COPY --chown=node:node services\/recovery-tool/);
  assert.match(identityDockerfile, /COPY --chown=node:node services\/shared/);
  assert.match(identityDockerfile, /COPY --chown=node:node tools\/usb-serial-helper/);
  assert.doesNotMatch(identityDockerfile, /platformio|services\/community-platform|tools\/migrate/);
  assert.match(composeFile, /identity-server:[\s\S]*dockerfile: docker\/identity-service\.Dockerfile[\s\S]*image: gernetix\/identity-server/);
});

test("keeps documentation and tests out of the shared runtime build context", () => {
  assert.match(dockerignore, /^docs$/m);
  assert.match(dockerignore, /^data$/m);
  assert.match(dockerignore, /^model$/m);
  assert.match(dockerignore, /^\*\*\/test$/m);
  assert.match(dockerignore, /^\*\*\/\*\.test\.js$/m);
  assert.match(dockerignore, /^tools\/architecture-docs$/m);
});

test("rejects a public wildcard binding for the Compute Worker Gateway", () => {
  assert.match(remoteDeploy, /COMPUTE_BIND_ADDRESS/);
  assert.match(remoteDeploy, /compute_bind_address.*0\.0\.0\.0/);
  assert.match(remoteDeploy, /COMPUTE_BIND_ADDRESS darf keinen oeffentlichen Wildcard-Listener verwenden/);
});

test("provisions missing staging secrets without replacing existing values", () => {
  assert.match(remoteDeploy, /grep -q "\^\$\{secret_name\}=\." "\$env_file"/);
  assert.match(remoteDeploy, /openssl rand -hex 32/);
  assert.match(remoteDeploy, /openssl rand -base64 32/);
  assert.match(remoteDeploy, /ensure_internal_api_keyset/);
  assert.match(remoteDeploy, /tools\/internal-api-key-provisioner\/index\.js/);
  assert.match(remoteDeploy, /docker run --rm/);
  assert.match(remoteDeploy, /--network none/);
  assert.match(remoteDeploy, /node:24-bookworm-slim[\s\\]+node tools\/internal-api-key-provisioner/);
  assert.match(remoteDeploy, /INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON/);
  assert.match(remoteDeploy, /ensure_staging_secret COMPUTE_WORKER_BOOTSTRAP_TOKEN hex/);
  assert.match(remoteDeploy, /ensure_staging_secret COMPUTE_WORKER_SIGNING_SECRET hex/);
  assert.match(remoteDeploy, /ensure_staging_secret COMPUTE_PROJECT_GRANT_SIGNING_SECRET hex/);
  assert.match(remoteDeploy, /ensure_staging_secret BUILD_ARTIFACT_UPLOAD_TOKEN hex/);
  assert.match(remoteDeploy, /ensure_staging_secret RUNTIME_STATE_ENCRYPTION_KEY base64/);
  assert.match(remoteDeploy, /ensure_staging_secret FORGEJO_POSTGRES_PASSWORD hex/);
  assert.match(remoteDeploy, /ensure_staging_secret FORGEJO_SECRET_KEY hex/);
  assert.match(remoteDeploy, /ensure_staging_secret FORGEJO_INTERNAL_TOKEN hex/);
  assert.match(remoteDeploy, /chmod 600 "\$env_file"/);
  assert.match(remoteDeploy, /tail -c 1 "\$env_file"/);
  assert.doesNotMatch(remoteDeploy, /ensure_staging_secret COMPUTE_INTERNAL_TOKEN/);
});
