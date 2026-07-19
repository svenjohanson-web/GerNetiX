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
COPY --chown=node:node tools/migrate-runtime-storage.js ./tools/migrate-runtime-storage.js
COPY --chown=node:node tools/publish-touch-demo-release.js ./tools/publish-touch-demo-release.js
COPY --chown=node:node Demoanwendungen/Boards/hardware.processor_board.esp32_s3_es3c28p/touch-spielesammlung ./Demoanwendungen/Boards/hardware.processor_board.esp32_s3_es3c28p/touch-spielesammlung
COPY --chown=node:node docker/healthcheck.js ./docker/healthcheck.js

RUN npm ci --omit=dev --prefix services/ai-context-server
RUN npm ci --omit=dev --prefix services/identity-server
RUN npm run verify:runtime-deps --prefix services/identity-server

RUN mkdir -p /var/lib/gernetix/services /var/lib/gernetix/identity /var/lib/gernetix/projects /var/lib/gernetix/telemetry /var/lib/gernetix/ai-context /var/lib/gernetix/build /var/lib/gernetix/admin-access /var/lib/gernetix/public-demos \
  && chown -R node:node /var/lib/gernetix /opt/platformio

USER node

CMD ["sh", "-c", "exec node services/${GERNETIX_SERVICE}/src/dev-server.js"]
