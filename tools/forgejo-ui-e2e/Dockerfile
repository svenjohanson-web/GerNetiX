FROM mcr.microsoft.com/playwright:v1.62.1-noble

WORKDIR /workspace

COPY tools/forgejo-ui-e2e/package.json tools/forgejo-ui-e2e/package-lock.json ./tools/forgejo-ui-e2e/
RUN cd tools/forgejo-ui-e2e && npm ci --ignore-scripts --no-audit --no-fund

COPY services/project-server/src ./services/project-server/src
COPY services/shared ./services/shared
# Von project-service.js eingebunden (buildMigrationPayload); ohne diese Datei
# bricht der Container beim Start mit MODULE_NOT_FOUND ab.
COPY tools/forgejo-migration-dry-run.js ./tools/forgejo-migration-dry-run.js
COPY services/identity-server/src/dev/project-repository-read.js ./services/identity-server/src/dev/project-repository-read.js
COPY services/identity-server/src/dev/project-repository-contract-stub.js ./services/identity-server/src/dev/project-repository-contract-stub.js
COPY services/identity-server/src/services/user-action-events.js ./services/identity-server/src/services/user-action-events.js
COPY services/identity-server/src/dev/server/project-routes.js ./services/identity-server/src/dev/server/project-routes.js
COPY services/identity-server/src/dev/server/route-registry.js ./services/identity-server/src/dev/server/route-registry.js
# Von project-routes.js eingebunden; ohne diese Datei bricht der Container beim Start.
COPY services/identity-server/src/services/user-action-events.js ./services/identity-server/src/services/user-action-events.js
COPY services/identity-server/public/app/project-repository-card.js ./services/identity-server/public/app/project-repository-card.js
COPY services/identity-server/public/app/app.css ./services/identity-server/public/app/app.css
COPY tools/forgejo-ui-e2e/run-ui-e2e.js ./tools/forgejo-ui-e2e/run-ui-e2e.js

CMD ["node", "tools/forgejo-ui-e2e/run-ui-e2e.js"]
