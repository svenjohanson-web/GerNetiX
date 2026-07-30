"use strict";

const http = require("node:http");

async function main() {
  const accessToken = process.env.ADMIN_TOOL_ACCESS_TOKEN || "";
  if (!accessToken) throw new Error("ADMIN_TOOL_ACCESS_TOKEN ist im Admin Tool nicht konfiguriert.");

  const actor = {
    actor_id: "desktop-process-monitor",
    role: "administrator",
    capabilities: ["admin_link_integrity"],
  };
  const result = await requestJson({
    baseUrl: process.env.ADMIN_TOOL_BASE_URL || "http://127.0.0.1:4600",
    pathname: "/api/admin/link-integrity?purpose=desktop_monitor_read",
    headers: {
      "x-gernetix-admin-access-token": accessToken,
      "x-gernetix-admin-actor": Buffer.from(JSON.stringify(actor)).toString("base64url"),
    },
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function requestJson({ baseUrl, pathname, headers }) {
  const target = new URL(pathname, baseUrl);
  return new Promise((resolve, reject) => {
    const request = http.get(target, { headers }, (response) => {
      const chunks = [];
      let length = 0;
      response.on("data", (chunk) => {
        length += chunk.length;
        if (length > 4 * 1024 * 1024) {
          request.destroy(new Error("Die Link-Integritätsantwort ist zu groß."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        let payload;
        try {
          payload = body ? JSON.parse(body) : {};
        } catch {
          reject(new Error("Das Admin Tool hat keine gültige JSON-Antwort geliefert."));
          return;
        }
        if ((response.statusCode || 500) < 200 || (response.statusCode || 500) >= 300) {
          reject(new Error(payload.message || payload.error || `Admin Tool antwortet mit HTTP ${response.statusCode}.`));
          return;
        }
        resolve(payload);
      });
    });
    request.setTimeout(10000, () => request.destroy(new Error("Zeitüberschreitung beim Admin-Tool-Aufruf.")));
    request.on("error", reject);
  });
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { requestJson };
