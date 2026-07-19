function canonicalLocalPasskeyLocation(req) {
  if (req.method !== "GET") return "";
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (requestUrl.hostname !== "127.0.0.1") return "";
  if (requestUrl.pathname !== "/" && !requestUrl.pathname.startsWith("/app/")) return "";
  requestUrl.hostname = "localhost";
  return requestUrl.toString();
}

module.exports = { canonicalLocalPasskeyLocation };
