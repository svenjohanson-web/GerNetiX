"use strict";

const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");
const { createHttpApp, sendJson } = require("../src/http-app");
const { issueInternalToken } = require("../../shared/internal-api-auth");

const secret = "hardware-shop-http-auth-test-key";

test("offers stay public while carts require service and matching account delegation", async () => {
  let writes = 0;
  const app = createHttpApp({ internalApiSigningKey: secret, service: {
    async listOffers() { return []; },
    async createCart(body) { writes += 1; return { cart_id:"cart-1", account_id:body.account_id }; },
  } });
  const server = await listen(app);
  try {
    assert.equal((await fetch(url(server, "/api/hardware-shop/offers"))).status, 200);
    assert.equal((await fetch(url(server, "/api/hardware-shop/carts"), post({ account_id:"acct-1" }))).status, 403);
    assert.equal((await fetch(url(server, "/api/hardware-shop/carts"), post({ account_id:"acct-1" }, delegated("shop.cart.write", "acct-2")))).status, 403);
    const response = await fetch(url(server, "/api/hardware-shop/carts"), post({ account_id:"acct-1" }, delegated("shop.cart.write", "acct-1")));
    assert.equal(response.status, 201);
    assert.equal(writes, 1);
  } finally { await close(server); }
});

function delegated(scope, accountId) {
  const common = { iss:"identity-server", sub:"identity-server", aud:"hardware-shop", scopes:[scope] };
  return {
    Authorization:`Bearer ${issueInternalToken(common, secret)}`,
    "X-GerNetiX-Delegation":issueInternalToken({ ...common, kind:"delegated_user_action", context:{ account_id:accountId } }, secret),
  };
}
function post(body, headers = {}) { return { method:"POST", headers:{ "Content-Type":"application/json", ...headers }, body:JSON.stringify(body) }; }
function url(server, path) { return `http://127.0.0.1:${server.address().port}${path}`; }
async function listen(app) { const server = http.createServer((req,res) => app(req,res).catch((error) => sendJson(res,error.status || 500,{ error:error.code || "internal" }))); await new Promise((resolve) => server.listen(0,"127.0.0.1",resolve)); return server; }
function close(server) { return new Promise((resolve) => server.close(resolve)); }
