"use strict";

const { requestJson } = require("./read-link-integrity");

async function main() {
  const accessToken = process.env.ADMIN_TOOL_ACCESS_TOKEN || "";
  if (!accessToken) throw new Error("ADMIN_TOOL_ACCESS_TOKEN ist im Admin Tool nicht konfiguriert.");
  const actor = {
    actor_id: "desktop-process-monitor",
    role: "administrator",
    capabilities: ["admin_operations_monitoring"],
  };
  const result = await requestJson({
    baseUrl: process.env.ADMIN_TOOL_BASE_URL || "http://127.0.0.1:4600",
    pathname: "/api/admin/user-action-events?limit=200",
    headers: {
      "x-gernetix-admin-access-token": accessToken,
      "x-gernetix-admin-actor": Buffer.from(JSON.stringify(actor)).toString("base64url"),
    },
  });
  process.stdout.write(`${JSON.stringify({ summary: result.summary || {} })}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  });
}
