const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { createDefaultIdentityModule, MockEmailService } = require("./index");

const publicDir = path.join(__dirname, "..", "public");
const guidedLessonDir = path.join(__dirname, "..", "..", "..", "tools", "guided-code-lesson");
const port = Number(process.env.PORT || 4300);
const host = process.env.HOST || "127.0.0.1";
const demoUsername = process.env.DEMO_USER || "demo";
const demoEmail = process.env.DEMO_EMAIL || "demo@gernetix.local";
const demoPassword = process.env.DEMO_PASSWORD || "demo-passwort";
const builtInDemoAccounts = [
  { username: demoUsername, email: demoEmail, password: demoPassword },
];

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".puml": "text/plain; charset=utf-8",
};

const emailService = new MockEmailService({ log() {} });
const auth = createDefaultIdentityModule({
  emailService,
  appBaseUrl: `http://${host}:${port}`,
});
const sessions = new Map();

async function bootstrap() {
  await seedDemoAccount();

  const server = http.createServer((req, res) => {
    routeRequest(req, res).catch((error) => {
      console.error(error);
      sendJson(res, 500, { error: "internal_server_error" });
    });
  });

  server.listen(port, host, () => {
    console.log(`Identity login UI: http://${host}:${port}`);
    console.log(`Tamagotchi demo: http://${host}:${port}/demo/tamagotchi/`);
    console.log(`Demo login: ${demoUsername} / ${demoPassword}`);
  });
}

async function seedDemoAccount() {
  for (const account of builtInDemoAccounts) {
    try {
      const beforeCount = emailService.sentMessages.length;
      await auth.register_local(account.username, account.email, account.password, true);
      const verification = emailService.sentMessages
        .slice(beforeCount)
        .find((message) => message.type === "verification");
      const token = verification ? new URL(verification.link).searchParams.get("token") : "";
      if (token) {
        await auth.verify_email(token);
      }
    } catch (error) {
      if (!["username_already_exists", "email_already_exists"].includes(error.code)) {
        throw error;
      }
    }
  }
}

async function routeRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/health") {
    sendJson(res, 200, { status: "ok", service: "identity-server" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    await handleLogin(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    await handleLogout(req, res);
    return;
  }

  if (url.pathname === "/api/session") {
    handleSession(req, res);
    return;
  }

  if (url.pathname === "/demo" || url.pathname === "/demo/") {
    redirect(res, "/demo/tamagotchi/");
    return;
  }

  if (url.pathname.startsWith("/demo/tamagotchi")) {
    if (!readSession(req)) {
      redirect(res, "/login.html?next=/demo/tamagotchi/");
      return;
    }
    serveStatic(res, guidedLessonDir, normalizeDemoPath(url.pathname));
    return;
  }

  const requestPath = url.pathname === "/" ? "/login.html" : url.pathname;
  serveStatic(res, publicDir, requestPath);
}

async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  try {
    const credentials = resolveDemoCredentials(body.identifier, body.password);
    const login = await auth.login_local(credentials.identifier, credentials.password);
    sessions.set(login.session.token, {
      account: login.account,
      expiresAt: login.session.expires_at,
    });
    setSessionCookie(res, login.session.token, login.session.expires_at);
    sendJson(res, 200, {
      account: login.account,
      next: sanitizeNextPath(body.next) || "/demo/tamagotchi/",
    });
  } catch (error) {
    sendJson(res, error.status || 401, {
      error: error.code || "invalid_login",
      message: "Login fehlgeschlagen.",
    });
  }
}

function resolveDemoCredentials(identifier, password) {
  if (identifier === "test" && password === "test") {
    return { identifier: demoUsername, password: demoPassword };
  }

  return { identifier, password };
}

async function handleLogout(req, res) {
  const token = readSessionToken(req);
  if (token) {
    sessions.delete(token);
    await auth.logout(token);
  }
  clearSessionCookie(res);
  sendJson(res, 200, { logged_out: true });
}

function handleSession(req, res) {
  const session = readSession(req);
  if (!session) {
    sendJson(res, 401, { authenticated: false });
    return;
  }

  sendJson(res, 200, {
    authenticated: true,
    account: session.account,
    expires_at: session.expiresAt,
  });
}

function serveStatic(res, rootDir, requestPath) {
  const normalizedRequestPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(rootDir, normalizedRequestPath));

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(content);
  });
}

function normalizeDemoPath(pathname) {
  const stripped = pathname.replace(/^\/demo\/tamagotchi\/?/, "/");
  return stripped === "/" || stripped === "" ? "/index.html" : stripped;
}

function readSession(req) {
  const token = readSessionToken(req);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

function readSessionToken(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies.gernetix_demo_session || "";
}

function parseCookies(cookieHeader) {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex < 0) return [part, ""];
        return [
          decodeURIComponent(part.slice(0, separatorIndex)),
          decodeURIComponent(part.slice(separatorIndex + 1)),
        ];
      }),
  );
}

function setSessionCookie(res, token, expiresAt) {
  res.setHeader("Set-Cookie", [
    `gernetix_demo_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`,
  ]);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", [
    "gernetix_demo_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
  ]);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) {
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sanitizeNextPath(value) {
  const next = String(value || "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "";
}

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
