"use strict";

function resolveIdentityRuntimePersistence(environment = process.env) {
  const runtimeLocation = String(environment.IDENTITY_RUNTIME_LOCATION || "").trim().toLowerCase();
  const remoteDevelopment = environment.IDENTITY_REMOTE_DEV === "1";
  if (runtimeLocation !== "server" && !(runtimeLocation === "local-development" && remoteDevelopment)) {
    throw new Error(
      "Identity Runtime darf nur auf dem Server oder als kontrollierter lokaler Remote-Dev-Prozess gestartet werden.",
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
