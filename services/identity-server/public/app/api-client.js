const ApiClient = (() => {
  async function getJson(url) {
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || payload.error || `Request failed: ${url}`);
      error.status = response.status;
      error.code = payload.error || "";
      throw error;
    }
    return payload;
  }

  async function postJson(url, body) {
    return writeJson("POST", url, body);
  }

  async function putJson(url, body) {
    return writeJson("PUT", url, body);
  }

  async function deleteJson(url) {
    const response = await fetch(url, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || `Request failed: ${url}`);
    return payload;
  }

  async function writeJson(method, url, body) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || `Request failed: ${url}`);
    return payload;
  }

  return {
    deleteJson,
    getJson,
    postJson,
    putJson,
  };
})();
