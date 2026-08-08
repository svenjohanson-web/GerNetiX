#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { loadConfig } = require("./src/config");
const { PATHS, SELECTORS, appUrl, isAuthPath, redactedResult } = require("./src/flow-contract");

async function main() {
  const config = loadConfig();
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const result = { ok: false, scenarios: [], target: config.baseUrl.href };

  try {
    // Deliberately one context/page: this suite validates user-visible behavior,
    // while k6 creates load. GERNETIX_BROWSER_WORKERS is a guarded future ceiling.
    assert.equal(config.workers, 1, "The initial browser flow requires exactly one worker");
    const context = await browser.newContext({
      baseURL: config.baseUrl.href,
      viewport: { width: 1024, height: 820 },
      recordVideo: undefined,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(config.timeoutMs);

    await verifyLoginBoundary(page, config);
    result.scenarios.push("login_boundary");

    await authenticateWithPreparedSession(context, config);
    await verifyProjectListAndDetail(page, config);
    result.scenarios.push("project_list_and_detail");

    await verifyVisibleDependencyFailure(page, config);
    result.scenarios.push("visible_dependency_failure");

    result.ok = true;
    await context.close();
  } finally {
    await browser.close();
  }

  process.stdout.write(`${JSON.stringify(redactedResult(result))}\n`);
}

async function verifyLoginBoundary(page, config) {
  await page.goto(appUrl(config.baseUrl, PATHS.protectedDashboard), { waitUntil: "domcontentloaded" });
  await page.waitForURL((url) => isAuthPath(url.href));
  await page.locator(SELECTORS.loginTitle).waitFor({ state: "visible" });
  assert.match((await page.locator(SELECTORS.loginTitle).innerText()).trim(), /Anmelden|Login/i);
}

async function authenticateWithPreparedSession(context, config) {
  await context.addCookies([{
    name: config.sessionCookieName,
    value: config.sessionCookieValue,
    domain: config.baseUrl.hostname,
    path: "/",
    httpOnly: true,
    secure: config.baseUrl.protocol === "https:",
    sameSite: "Strict",
  }]);
}

async function verifyProjectListAndDetail(page, config) {
  await page.goto(appUrl(config.baseUrl, PATHS.projectList), { waitUntil: "domcontentloaded" });
  assert.equal(isAuthPath(page.url()), false, "Prepared test session must authenticate the app shell");
  const cards = page.locator(SELECTORS.projectCard);
  await cards.first().waitFor({ state: "visible" });
  assert.ok(await cards.count() > 0, "Project list must contain at least one project");
  const expectedTitle = (await cards.first().locator("h2").innerText()).trim();
  await cards.first().click();
  await page.waitForURL((url) => url.pathname === "/app/learning-project-overview/" && url.searchParams.has("project"));
  const detail = page.locator(SELECTORS.projectDetail);
  await detail.waitFor({ state: "visible" });
  assert.equal((await detail.innerText()).trim(), expectedTitle, "Selected project detail must match the list entry");
}

async function verifyVisibleDependencyFailure(page, config) {
  await page.route("**/api/passkeys/authentication/options", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "identity_persistence_unavailable",
        message: "Anmeldung ist vorübergehend nicht verfügbar.",
      }),
    });
  });
  await page.goto(appUrl(config.baseUrl, PATHS.auth), { waitUntil: "domcontentloaded" });
  await page.locator(SELECTORS.showIdentifierLogin).click();
  await page.locator(SELECTORS.loginIdentifier).fill("system-test-user");
  await page.locator(SELECTORS.loginForm).locator('button[type="submit"]').click();
  const status = page.locator(SELECTORS.loginStatus);
  await status.waitFor({ state: "visible" });
  await assertVisibleText(status, /vorübergehend|nicht verfügbar|fehlgeschlagen/i);
  await page.unrouteAll({ behavior: "wait" });
}

async function assertVisibleText(locator, pattern) {
  const text = (await locator.innerText()).trim();
  assert.match(text, pattern, "Dependency failure must be explained visibly to the user");
}

main().catch((error) => {
  process.stderr.write(`${safeErrorText(error, [process.env.GERNETIX_BROWSER_SESSION_COOKIE_VALUE])}\n`);
  process.exitCode = 1;
});

function safeErrorText(error, secrets) {
  let text = String(error?.stack || error?.message || error || "browser_system_test_failed");
  for (const secret of secrets) {
    if (!secret) continue;
    text = text.split(String(secret)).join("[REDACTED]");
  }
  return text;
}
