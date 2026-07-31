"use strict";

function resolveIdentityRuntimePersistence(environment = process.env) {
  const runtimeLocation = String(environment.IDENTITY_RUNTIME_LOCATION || "").trim().toLowerCase();
  if (runtimeLocation !== "server") {
    throw new Error(
      "Identity Runtime darf nur als kanonischer Serverdienst gestartet werden. Lokale Identity-Prozesse sind deaktiviert.",
    );
  }
  const backend = String(environment.IDENTITY_PERSISTENCE_BACKEND || "postgres").trim().toLowerCase();
  if (!["postgres", "postgresql"].includes(backend)) {
    throw new Error(
      "Identity Runtime darf ausschliesslich PostgreSQL verwenden. SQLite ist nur fuer isolierte Repository-Tests und Legacy-Migrationen erlaubt.",
    );
  }
  return "postgres";
}

module.exports = { resolveIdentityRuntimePersistence };
