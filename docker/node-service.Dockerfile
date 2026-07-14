FROM node:24-bookworm-slim

ENV NODE_ENV=production
ENV PLATFORMIO_COMMAND=/opt/platformio/bin/platformio
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates openssl \
  && python3 -m venv /opt/platformio \
  && /opt/platformio/bin/pip install --no-cache-dir platformio==6.1.18 \
  && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node services ./services
COPY --chown=node:node basissoftware ./basissoftware
COPY --chown=node:node docker/healthcheck.js ./docker/healthcheck.js

RUN npm ci --omit=dev --prefix services/ai-context-server

RUN mkdir -p /var/lib/gernetix/services /var/lib/gernetix/identity /var/lib/gernetix/ai-context /var/lib/gernetix/build \
  && chown -R node:node /var/lib/gernetix /opt/platformio

USER node

CMD ["sh", "-c", "exec node services/${GERNETIX_SERVICE}/src/dev-server.js"]
