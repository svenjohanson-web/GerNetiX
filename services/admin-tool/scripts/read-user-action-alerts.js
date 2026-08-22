"use strict";

const { adminHeaders, requestJson } = require("./read-link-integrity");
const { readOptionalInternalApiAuthConfig } = require("../../shared/internal-api-auth-env");

async function main() {
  const signingKey = readOptionalInternalApiAuthConfig(process.env, "admin-tool");
  if (!signingKey) throw new Error("Interne API-Authentifizierung ist im Admin Tool nicht konfiguriert.");
  const actor = {
    actor_id: "desktop-process-monitor",
    role: "administrator",
    capabilities: ["admin_operations_monitoring"],
  };
  const result = await requestJson({
    baseUrl: process.env.ADMIN_TOOL_BASE_URL || "http://127.0.0.1:4600",
    pathname: "/api/admin/user-action-events?limit=200",
    headers: adminHeaders(signingKey, actor),
  });
  process.stdout.write(`${JSON.stringify({ summary: result.summary || {} })}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  });
}
