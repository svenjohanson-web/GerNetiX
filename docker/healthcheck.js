"use strict";

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) process.exit(2);

fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2500) })
  .then((response) => process.exit(response.ok ? 0 : 1))
  .catch(() => process.exit(1));

