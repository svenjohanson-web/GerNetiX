FROM node:24-bookworm-slim

ENV NODE_ENV=production
ENV PLATFORMIO_COMMAND=/opt/platformio/bin/platformio
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates \
  && python3 -m venv /opt/platformio \
  && /opt/platformio/bin/pip install --no-cache-dir platformio==6.1.18 \
  && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node services/shared ./services/shared
COPY --chown=node:node services/build-deploy-server ./services/build-deploy-server
COPY --chown=node:node docker/healthcheck.js ./docker/healthcheck.js

RUN mkdir -p /var/lib/gernetix/build \
  && chown -R node:node /var/lib/gernetix /opt/platformio

USER node
CMD ["node", "services/build-deploy-server/src/dev-server.js"]
