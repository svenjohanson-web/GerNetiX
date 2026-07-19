const GerNetiXSerialService = (() => {
  const DEFAULT_BASE_URLS = window.location.protocol === "https:"
    ? ["https://localhost:43123"]
    : ["https://localhost:43123", "http://127.0.0.1:43123"];

  function create(options = {}) {
    const baseUrls = options.baseUrl ? [options.baseUrl] : DEFAULT_BASE_URLS;
    let baseUrl = baseUrls[0];
    let session = "";

    async function request(path, init = {}, authenticated = true, requestBaseUrl = baseUrl) {
      if (authenticated && !session) await connect();
      const headers = {
        "Content-Type": "application/json",
        ...(authenticated ? { "X-GerNetiX-Serial-Session": session } : {}),
        ...(init.headers || {}),
      };
      const response = await fetch(`${requestBaseUrl}${path}`, {
        ...init,
        headers,
        cache: "no-store",
        targetAddressSpace: "loopback",
      });
      const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401 && authenticated) session = "";
        const error = new Error(payload?.message || `Der lokale GerNetiX Serial Service antwortet mit Status ${response.status}.`);
        error.code = payload?.error || "serial_service_request_failed";
        error.status = response.status;
        throw error;
      }
      return payload;
    }

    async function status() {
      let lastError = null;
      for (const candidate of baseUrls) {
        try {
          const result = await request("/v1/status", { method: "GET" }, false, candidate);
          baseUrl = candidate;
          return result;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error("Der lokale GerNetiX Serial Service ist nicht erreichbar.");
    }

    async function connect() {
      await status();
      const result = await request("/v1/sessions", { method: "POST", body: "{}" }, false);
      session = result.token;
      return result;
    }

    async function available() {
      try {
        await status();
        return true;
      } catch {
        return false;
      }
    }

    async function ports() {
      return (await request("/v1/ports", { method: "GET" })).items || [];
    }

    async function probe(port) {
      return request("/v1/probe", { method: "POST", body: JSON.stringify({ port }) });
    }

    async function flash({ port, files, ...options }) {
      const encodedFiles = files.map((file) => ({
        name: file.name || "firmware.bin",
        address: Number(file.address || 0),
        dataBase64: bytesToBase64(file.data),
      }));
      let job = await request("/v1/flash-jobs", {
        method: "POST",
        body: JSON.stringify({ port, files: encodedFiles, ...options }),
      });
      options.onProgress?.(job);
      while (["queued", "running"].includes(job.status)) {
        await delay(300);
        job = await request(`/v1/flash-jobs/${encodeURIComponent(job.id)}`, { method: "GET" });
        options.onProgress?.(job);
      }
      if (job.status !== "succeeded") throw new Error(job.error || "Der lokale USB-Flash ist fehlgeschlagen.");
      return job;
    }

    async function serialRequest(port, action, payload = {}) {
      const requestId = crypto.randomUUID();
      return request("/v1/serial/requests", {
        method: "POST",
        body: JSON.stringify({
          port,
          request: {
            type: "gernetix.serial_provisioning",
            action,
            request_id: requestId,
            ...payload,
          },
        }),
      });
    }

    async function waitReady(port, timeoutMs = 30000) {
      return request("/v1/serial/wait-ready", {
        method: "POST",
        body: JSON.stringify({ port, timeoutMs }),
      });
    }

    return { available, connect, flash, ports, probe, serialRequest, status, waitReady };
  }

  function bytesToBase64(value) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    const chunks = [];
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
    }
    return btoa(chunks.join(""));
  }

  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  return { create };
})();
