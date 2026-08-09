"use strict";

const apply = process.argv.includes("--apply");
const projectArgument = process.argv.find((value) => value.startsWith("--project="));
const baseUrl = String(process.env.PROJECT_SERVER_BASE_URL || "http://127.0.0.1:4800").replace(/\/$/, "");
const token = String(process.env.PROJECT_ADMIN_READ_TOKEN || "");

async function main() {
  if (!token) throw new Error("PROJECT_ADMIN_READ_TOKEN_required");
  const response = await fetch(`${baseUrl}/api/internal/repositories/migrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-GerNetiX-Project-Admin-Token": token },
    body: JSON.stringify({ apply, project_id: projectArgument ? projectArgument.slice("--project=".length) : "" }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `HTTP_${response.status}`);
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message || error}\n`);
  process.exitCode = 1;
});
