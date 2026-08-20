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
      notifyRevokedSession(response, payload);
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
      notifyRevokedSession(response, payload);
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
      notifyRevokedSession(response, payload);
      const error = new Error(payload.message || payload.error || `Request failed: ${url}`);
      error.status = response.status;
      error.code = payload.error || "";
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function notifyRevokedSession(response, payload) {
    if (response.status !== 401 || payload?.error !== "session_revoked") return;
    window.dispatchEvent(new CustomEvent("gernetix:session-revoked", {
      detail: { reason: payload.reason || "revoked" },
    }));
  }

  return {
    deleteJson,
    getJson,
    patchJson,
    postJson,
    putJson,
  };
})();

/*
 * Uebergangsbruecke.
 *
 * Diese Datei ist ein ES-Modul, ihre Namen sind damit nicht mehr global. Die
 * Dateien, die ApiClient heute benutzen, sind aber noch klassische Skripte und
 * lesen den Namen global. Bis sie ihn einfuehren, wird er hier ausdruecklich
 * bereitgestellt.
 *
 * ApiClient ist ein unveraenderliches Namensraum-Objekt und wird nie neu
 * zugewiesen, deshalb genuegt eine einfache Zuweisung. Bei veraenderlichen
 * Werten waeren Zugriffsmethoden noetig, sonst liefe die Zuweisung eines
 * klassischen Skripts am Modul vorbei.
 */
export { ApiClient };
globalThis.ApiClient = ApiClient;
