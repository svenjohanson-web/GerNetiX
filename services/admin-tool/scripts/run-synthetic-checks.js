"use strict";

const http = require("node:http");

async function main() {
  const token = process.env.SYSTEM_EVENT_INGEST_TOKEN || "";
  if (!token) throw new Error("SYSTEM_EVENT_INGEST_TOKEN ist fuer den synthetischen Monitor nicht konfiguriert.");
  const result = await requestRun({
    baseUrl: process.env.ADMIN_TOOL_BASE_URL || "http://127.0.0.1:4600",
    token,
    timeoutMs: Number(process.env.SYNTHETIC_CHECK_TIMEOUT_MS || 1500),
  });
  process.stdout.write(`${JSON.stringify({ latest_run_id: result.latest_run_id, summary: result.summary })}\n`);
  if (Number(result.summary?.failed || 0) > 0) process.exitCode = 2;
}

function requestRun({ baseUrl, token, timeoutMs }) {
  const target = new URL("/api/internal/synthetic-checks/run", baseUrl);
  const body = Buffer.from(JSON.stringify({ timeout_ms: timeoutMs }));
  return new Promise((resolve, reject) => {
    const request = http.request(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": body.length,
        "X-GerNetiX-System-Event-Token": token,
      },
    }, (response) => {
      const chunks = [];
      let length = 0;
      response.on("data", (chunk) => {
        length += chunk.length;
        if (length > 1024 * 1024) request.destroy(new Error("Synthetische Pruefantwort ist zu gross."));
        else chunks.push(chunk);
      });
      response.on("end", () => {
        let payload;
        try { payload = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
        catch { return reject(new Error("Admin Tool lieferte keine gueltige JSON-Antwort.")); }
        if ((response.statusCode || 500) < 200 || (response.statusCode || 500) >= 300) {
          return reject(new Error(payload.message || payload.error || `Admin Tool antwortet mit HTTP ${response.statusCode}.`));
        }
        resolve(payload);
      });
    });
    request.setTimeout(Math.max(5000, timeoutMs * 5), () => request.destroy(new Error("Zeitueberschreitung beim synthetischen Prueflauf.")));
    request.on("error", reject);
    request.end(body);
  });
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message || error}\n`);
    process.exitCode = 1;
  });
}

module.exports = { requestRun };
