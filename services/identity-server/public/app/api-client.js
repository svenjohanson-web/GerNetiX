const ApiClient = (() => {
  async function getJson(url, options = {}) {
    const action = options.action;
    const response = await fetch(url, {
      headers: {
        ...(action ? { "X-GerNetiX-Action-Id": action.id, "X-GerNetiX-Action-Type": action.type } : {}),
        ...(options.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || payload.error || `Request failed: ${url}`);
      error.status = response.status;
      error.code = payload.error || "";
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async function postJson(url, body, options = {}) {
    return writeJson("POST", url, body, options);
  }

  async function putJson(url, body, options = {}) {
    return writeJson("PUT", url, body, options);
  }

  async function patchJson(url, body) {
    return writeJson("PATCH", url, body);
  }

  async function deleteJson(url) {
    const response = await fetch(url, { method: "DELETE" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || payload.error || `Request failed: ${url}`);
      error.status = response.status;
      error.code = payload.error || "";
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  async function writeJson(method, url, body, options = {}) {
    const action = options.action;
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(action ? { "X-GerNetiX-Action-Id": action.id, "X-GerNetiX-Action-Type": action.type } : {}),
        ...(options.headers || {}),
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || payload.error || `Request failed: ${url}`);
      error.status = response.status;
      error.code = payload.error || "";
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  return {
    deleteJson,
    getJson,
    patchJson,
    postJson,
    putJson,
  };
})();
