const { DeviceVoiceError } = require("./errors");

const prefix = "/api/device-voice";

function createHttpApp(options) {
  const service = options.service;

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "device-voice-orchestrator" });
      return;
    }
    if (req.method === "GET" && path === `${prefix}/capabilities`) {
      sendJson(res, 200, service.capabilities());
      return;
    }
    if (req.method === "POST" && path === `${prefix}/sessions`) {
      sendJson(res, 201, await service.createSession(await readJsonBody(req, 64 * 1024)));
      return;
    }
    const audio = path.match(new RegExp(`^${prefix}/sessions/([^/]+)/audio$`));
    if (req.method === "POST" && audio) {
      const token = bearerToken(req.headers.authorization);
      const result = await service.processAudio(
        decodeURIComponent(audio[1]),
        token,
        await readBinaryBody(req, 15 * 16000 * 2),
        req.headers["content-type"],
      );
      res.writeHead(200, {
        "Content-Type": result.content_type,
        "Content-Length": result.audio.length,
        "Cache-Control": "no-store",
        "X-GerNetiX-Session-Status": result.session_status,
      });
      res.end(result.audio);
      return;
    }
    sendJson(res, 404, { error: "not_found" });
  };
}

function readJsonBody(req, limit) {
  return readBinaryBody(req, limit).then((body) => {
    try {
      return body.length ? JSON.parse(body.toString("utf8")) : {};
    } catch {
      throw new DeviceVoiceError("invalid_json", "Request Body ist kein gueltiges JSON.", 400);
    }
  });
}

function readBinaryBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    req.on("data", (chunk) => {
      length += chunk.length;
      if (length > limit) {
        reject(new DeviceVoiceError("request_too_large", "Request ist zu gross.", 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function bearerToken(header) {
  const match = String(header || "").match(/^Bearer\s+(.+)$/i);
  if (!match) throw new DeviceVoiceError("voice_session_token_missing", "Voice-Session-Token fehlt.", 401);
  return match[1];
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(payload));
}

module.exports = { createHttpApp, sendJson };
