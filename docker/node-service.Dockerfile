FROM node:24-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node services ./services
COPY --chown=node:node docker/healthcheck.js ./docker/healthcheck.js

RUN mkdir -p /var/lib/gernetix/services /var/lib/gernetix/identity /var/lib/gernetix/ai-context /var/lib/gernetix/build \
  && chown -R node:node /var/lib/gernetix

USER node

CMD ["sh", "-c", "exec node services/${GERNETIX_SERVICE}/src/dev-server.js"]

