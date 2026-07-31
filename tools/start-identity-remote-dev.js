#!/usr/bin/env node
"use strict";

function main() {
  throw new Error(
    "Lokaler Identity-Remote-Dev ist deaktiviert. Verwende ausschliesslich die kanonische Server-PWA und ihre PostgreSQL-Identity.",
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Remote-Dev-Start fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { main };
