FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node services/shared ./services/shared
COPY --chown=node:node services/project-server ./services/project-server
COPY --chown=node:node firmware/gernetix-flashbox ./firmware/gernetix-flashbox
COPY --chown=node:node firmware/shared/gernetix-runtime-core ./firmware/shared/gernetix-runtime-core
COPY --chown=node:node tools/submit-flashbox-build-job.js ./tools/submit-flashbox-build-job.js
COPY --chown=node:node docker/healthcheck.js ./docker/healthcheck.js

RUN mkdir -p /var/lib/gernetix/projects \
  && chown -R node:node /var/lib/gernetix

USER node
CMD ["node", "services/project-server/src/dev-server.js"]
