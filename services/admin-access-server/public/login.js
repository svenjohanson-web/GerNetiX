const statusNode = document.querySelector("#status");
async function session() { const response = await fetch("/api/admin-access/session"); return response.ok ? response.json() : null; }
async function start() { if (await session()) location.replace("/admin/console/"); }
document.querySelector("#loginForm").addEventListener("submit", async (event) => { event.preventDefault(); statusNode.textContent = "Anmeldung wird geprueft …"; const response = await fetch("/api/admin-access/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: document.querySelector("#username").value, password: document.querySelector("#password").value }) }); if (response.ok) return location.replace("/admin/console/"); const result = await response.json().catch(() => ({})); statusNode.textContent = result.message || "Anmeldung nicht moeglich."; });
start();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/admin/sw.js").catch(() => {});
