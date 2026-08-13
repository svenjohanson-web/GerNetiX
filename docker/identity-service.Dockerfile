FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node services/identity-server/package.json services/identity-server/package-lock.json ./services/identity-server/
RUN npm ci --prefix services/identity-server

COPY --chown=node:node services/identity-server ./services/identity-server
COPY --chown=node:node modules/virtual-electronics-lab ./modules/virtual-electronics-lab
COPY --chown=node:node services/recovery-tool ./services/recovery-tool
COPY --chown=node:node services/shared ./services/shared
COPY --chown=node:node tools/usb-serial-helper ./tools/usb-serial-helper
COPY --chown=node:node docker/healthcheck.js ./docker/healthcheck.js

RUN npm run verify:runtime-deps --prefix services/identity-server
RUN npm run build:browser --prefix services/identity-server \
  && npm prune --omit=dev --prefix services/identity-server

RUN mkdir -p /var/lib/gernetix/identity /var/lib/gernetix/build \
  && chown -R node:node /var/lib/gernetix

USER node

CMD ["node", "services/identity-server/src/dev-server.js"]
