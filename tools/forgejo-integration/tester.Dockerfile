FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY services/project-server/src ./services/project-server/src
COPY tools/forgejo-integration/integration-test.js ./tools/forgejo-integration/integration-test.js

USER node

CMD ["node", "tools/forgejo-integration/integration-test.js"]
