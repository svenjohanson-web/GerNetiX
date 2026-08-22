FROM node:26-bookworm-slim

ENV NODE_ENV=production
ENV PLATFORMIO_COMMAND=/opt/platformio/bin/platformio
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates openssl git \
  && python3 -m venv /opt/platformio \
  && /opt/platformio/bin/pip install --no-cache-dir platformio==6.1.18 \
  && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node services/ai-context-server/package.json services/ai-context-server/package-lock.json ./services/ai-context-server/
COPY --chown=node:node services/identity-server/package.json services/identity-server/package-lock.json ./services/identity-server/
COPY --chown=node:node services/project-server/package.json services/project-server/package-lock.json ./services/project-server/
COPY --chown=node:node services/telemetry-server/package.json services/telemetry-server/package-lock.json ./services/telemetry-server/
COPY --chown=node:node services/community-platform/package.json services/community-platform/package-lock.json ./services/community-platform/
COPY --chown=node:node services/device-management-server/package.json services/device-management-server/package-lock.json ./services/device-management-server/
COPY --chown=node:node services/ai-usage-server/package.json services/ai-usage-server/package-lock.json ./services/ai-usage-server/
COPY --chown=node:node services/device-voice-orchestrator/package.json services/device-voice-orchestrator/package-lock.json ./services/device-voice-orchestrator/
COPY --chown=node:node services/hardware-catalog/package.json services/hardware-catalog/package-lock.json ./services/hardware-catalog/
COPY --chown=node:node services/hardware-shop/package.json services/hardware-shop/package-lock.json ./services/hardware-shop/
COPY --chown=node:node services/admin-tool/package.json services/admin-tool/package-lock.json ./services/admin-tool/
COPY --chown=node:node services/admin-access-server/package.json services/admin-access-server/package-lock.json ./services/admin-access-server/
COPY --chown=node:node services/build-deploy-server/package.json services/build-deploy-server/package-lock.json ./services/build-deploy-server/
COPY --chown=node:node services/compute-control-plane/package.json services/compute-control-plane/package-lock.json ./services/compute-control-plane/
COPY --chown=node:node services/public-demo-server/package.json services/public-demo-server/package-lock.json ./services/public-demo-server/
COPY --chown=node:node services/context-manager/package.json services/context-manager/package-lock.json ./services/context-manager/

RUN npm ci --omit=dev --prefix services/ai-context-server
RUN npm ci --omit=dev --prefix services/identity-server
RUN npm ci --omit=dev --prefix services/project-server
RUN npm ci --omit=dev --prefix services/telemetry-server
RUN npm ci --omit=dev --prefix services/community-platform
RUN npm ci --omit=dev --prefix services/device-management-server
RUN npm ci --omit=dev --prefix services/ai-usage-server
RUN npm ci --omit=dev --prefix services/device-voice-orchestrator
RUN npm ci --omit=dev --prefix services/hardware-catalog
RUN npm ci --omit=dev --prefix services/hardware-shop
RUN npm ci --omit=dev --prefix services/admin-tool
RUN npm ci --omit=dev --prefix services/admin-access-server
RUN npm ci --omit=dev --prefix services/build-deploy-server
RUN npm ci --omit=dev --prefix services/compute-control-plane
RUN npm ci --omit=dev --prefix services/public-demo-server
RUN npm ci --omit=dev --prefix services/context-manager

COPY --chown=node:node services ./services
COPY --chown=node:node docs/system-process-application-uml.md docs/system-process-application-uml.svg ./docs/
COPY --chown=node:node modules/virtual-electronics-lab ./modules/virtual-electronics-lab
COPY --chown=node:node firmware/shared/gernetix-runtime-core ./firmware/shared/gernetix-runtime-core
COPY --chown=node:node tools/migrate-runtime-storage.js ./tools/migrate-runtime-storage.js
COPY --chown=node:node tools/migrate-identity-sqlite-to-postgres.js ./tools/migrate-identity-sqlite-to-postgres.js
COPY --chown=node:node tools/migrate-project-sqlite-to-postgres.js ./tools/migrate-project-sqlite-to-postgres.js
COPY --chown=node:node tools/forgejo-migration-dry-run.js ./tools/forgejo-migration-dry-run.js
COPY --chown=node:node tools/migrate-telemetry-sqlite-to-postgres.js ./tools/migrate-telemetry-sqlite-to-postgres.js
COPY --chown=node:node tools/migrate-community-sqlite-to-postgres.js ./tools/migrate-community-sqlite-to-postgres.js
COPY --chown=node:node tools/migrate-device-management-sqlite-to-postgres.js ./tools/migrate-device-management-sqlite-to-postgres.js
COPY --chown=node:node tools/migrate-ai-usage-sqlite-to-postgres.js ./tools/migrate-ai-usage-sqlite-to-postgres.js
COPY --chown=node:node tools/migrate-hardware-catalog-sqlite-to-postgres.js ./tools/migrate-hardware-catalog-sqlite-to-postgres.js
COPY --chown=node:node tools/migrate-hardware-shop-sqlite-to-postgres.js ./tools/migrate-hardware-shop-sqlite-to-postgres.js
COPY --chown=node:node tools/migrate-operations-sqlite-to-postgres.js ./tools/migrate-operations-sqlite-to-postgres.js
COPY --chown=node:node tools/migrate-runtime-sqlite-to-postgres.js ./tools/migrate-runtime-sqlite-to-postgres.js
COPY --chown=node:node tools/migrate-postgres-binaries-to-artifact-store.js ./tools/migrate-postgres-binaries-to-artifact-store.js
COPY --chown=node:node tools/audit-postgres-binaries.js ./tools/audit-postgres-binaries.js
COPY --chown=node:node tools/migrate-postgres-domains-to-runtime.js ./tools/migrate-postgres-domains-to-runtime.js
COPY --chown=node:node tools/provision-build-worker-postgres.js ./tools/provision-build-worker-postgres.js
COPY --chown=node:node tools/provision-forgejo-developer-access.js ./tools/provision-forgejo-developer-access.js
COPY --chown=node:node tools/publish-platform-download.js ./tools/publish-platform-download.js
COPY --chown=node:node tools/usb-serial-helper ./tools/usb-serial-helper
COPY --chown=node:node docker/healthcheck.js ./docker/healthcheck.js

RUN npm run verify:runtime-deps --prefix services/identity-server

RUN mkdir -p /var/lib/gernetix/services /var/lib/gernetix/identity /var/lib/gernetix/projects /var/lib/gernetix/telemetry /var/lib/gernetix/ai-context /var/lib/gernetix/build /var/lib/gernetix/admin-access /var/lib/gernetix/public-demos /var/lib/gernetix/community \
  && chown -R node:node /var/lib/gernetix /opt/platformio

USER node

CMD ["sh", "-c", "exec node services/${GERNETIX_SERVICE}/src/dev-server.js"]
