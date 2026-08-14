const { DeviceManagementError } = require("./errors");
const { assertDelegatedResource, readBearerToken, verifyDelegation, verifyInternalToken } = require("../../shared/internal-api-auth");

const prefix = "/api/device-management";

function createHttpApp(options) {
  const service = options.service;
  const signingKey = options.internalApiSigningKey || "";

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "device-management-server" });
      return;
    }

    if (req.method === "GET" && ["/", prefix].includes(path)) {
      sendJson(res, 200, {
        service: "device-management-server",
        status: "ok",
        api_prefix: prefix,
        health: "/health",
        endpoints: {
          register_device: `${prefix}/devices/register`,
          account_devices: `${prefix}/accounts/{accountId}/devices`,
          admin_devices: `${prefix}/admin/devices`,
        },
      });
      return;
    }

    authorizeRequest(req, url, signingKey);

    if (req.method === "POST" && path === `${prefix}/devices/register`) {
      sendJson(res, 201, await service.registerDevice(await readJsonBody(req)));
      return;
    }

    const heartbeat = path.match(new RegExp(`^${prefix}/devices/([^/]+)/heartbeat$`));
    if (req.method === "POST" && heartbeat) {
      sendJson(res, 200, await service.heartbeat(decodeURIComponent(heartbeat[1]), await readJsonBody(req)));
      return;
    }

    const status = path.match(new RegExp(`^${prefix}/devices/([^/]+)/status$`));
    if (req.method === "GET" && status) {
      sendJson(res, 200, await service.getStatus(decodeURIComponent(status[1])));
      return;
    }

    const pushRecipients = path.match(new RegExp(`^${prefix}/devices/([^/]+)/push-recipients$`));
    if (req.method === "GET" && pushRecipients) {
      sendJson(res, 200, await service.pushRecipients(decodeURIComponent(pushRecipients[1])));
      return;
    }

    const challenge = path.match(new RegExp(`^${prefix}/devices/([^/]+)/auth/challenge$`));
    if (req.method === "POST" && challenge) {
      sendJson(res, 201, await service.createChallenge(decodeURIComponent(challenge[1])));
      return;
    }

    const verify = path.match(new RegExp(`^${prefix}/devices/([^/]+)/auth/verify$`));
    if (req.method === "POST" && verify) {
      sendJson(res, 200, await service.verifyChallenge(decodeURIComponent(verify[1]), await readJsonBody(req)));
      return;
    }

    const voiceAuthorize = path.match(new RegExp(`^${prefix}/devices/([^/]+)/voice-authorize$`));
    if (req.method === "POST" && voiceAuthorize) {
      sendJson(res, 200, await service.authorizeVoiceSession(
        decodeURIComponent(voiceAuthorize[1]),
        await readJsonBody(req),
      ));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/pairing/sessions`) {
      sendJson(res, 201, await service.createPairingSession(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/provisioning/tokens`) {
      sendJson(res, 201, await service.createProvisioningToken(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/provisioning/tokens/consume`) {
      sendJson(res, 200, await service.consumeProvisioningToken(await readJsonBody(req)));
      return;
    }

    const pairing = path.match(new RegExp(`^${prefix}/pairing/sessions/([^/]+)$`));
    if (req.method === "GET" && pairing) {
      sendJson(res, 200, await service.getPairingSession(decodeURIComponent(pairing[1])));
      return;
    }

    const pairingComplete = path.match(new RegExp(`^${prefix}/pairing/sessions/([^/]+)/complete$`));
    if (req.method === "POST" && pairingComplete) {
      sendJson(res, 200, await service.completePairing(decodeURIComponent(pairingComplete[1]), await readJsonBody(req)));
      return;
    }

    const pairingCancel = path.match(new RegExp(`^${prefix}/pairing/sessions/([^/]+)/cancel$`));
    if (req.method === "POST" && pairingCancel) {
      sendJson(res, 200, await service.cancelPairing(decodeURIComponent(pairingCancel[1])));
      return;
    }

    const accountDevices = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/devices$`));
    if (req.method === "GET" && accountDevices) {
      sendJson(res, 200, { items: await service.listAccountDevices(decodeURIComponent(accountDevices[1])) });
      return;
    }

    const accountBoards = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/board-configurations$`));
    if (req.method === "GET" && accountBoards) {
      sendJson(res, 200, { items: await service.listAccountBoards(decodeURIComponent(accountBoards[1])) });
      return;
    }
    if (req.method === "POST" && accountBoards) {
      sendJson(res, 201, await service.createAccountBoard(decodeURIComponent(accountBoards[1]), await readJsonBody(req)));
      return;
    }

    const accountBoard = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/board-configurations/([^/]+)$`));
    if (req.method === "GET" && accountBoard) {
      sendJson(res, 200, await service.getAccountBoard(
        decodeURIComponent(accountBoard[1]), decodeURIComponent(accountBoard[2]), url.searchParams.get("version"),
      ));
      return;
    }

    const accountBoardVersions = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/board-configurations/([^/]+)/versions$`));
    if (req.method === "GET" && accountBoardVersions) {
      sendJson(res, 200, { items: await service.listAccountBoardVersions(
        decodeURIComponent(accountBoardVersions[1]), decodeURIComponent(accountBoardVersions[2]),
      ) });
      return;
    }
    if (req.method === "POST" && accountBoardVersions) {
      sendJson(res, 201, await service.createAccountBoardVersion(
        decodeURIComponent(accountBoardVersions[1]), decodeURIComponent(accountBoardVersions[2]), await readJsonBody(req),
      ));
      return;
    }
    if (req.method === "POST" && accountDevices) {
      sendJson(res, 201, await service.addAccountDevice(decodeURIComponent(accountDevices[1]), await readJsonBody(req)));
      return;
    }

    const accountDevice = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/devices/([^/]+)$`));
    if (req.method === "PUT" && accountDevice) {
      sendJson(res, 200, await service.updateAccountDeviceBasissoftwareProfile(
        decodeURIComponent(accountDevice[1]),
        decodeURIComponent(accountDevice[2]),
        await readJsonBody(req),
      ));
      return;
    }

    const accountDeviceVoicePolicy = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/devices/([^/]+)/voice-ai-policy$`));
    if (req.method === "PUT" && accountDeviceVoicePolicy) {
      sendJson(res, 200, await service.updateAccountDeviceVoiceAiPolicy(
        decodeURIComponent(accountDeviceVoicePolicy[1]),
        decodeURIComponent(accountDeviceVoicePolicy[2]),
        await readJsonBody(req),
      ));
      return;
    }
    if (req.method === "DELETE" && accountDevice) {
      sendJson(res, 200, await service.removeAccountDevice(decodeURIComponent(accountDevice[1]), decodeURIComponent(accountDevice[2])));
      return;
    }

    const otaTargets = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/ota-targets$`));
    if (req.method === "GET" && otaTargets) {
      sendJson(res, 200, {
        items: await service.otaTargets(decodeURIComponent(otaTargets[1]), Object.fromEntries(url.searchParams.entries())),
      });
      return;
    }

    const purchaseContexts = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/purchase-contexts$`));
    if (req.method === "GET" && purchaseContexts) {
      sendJson(res, 200, { items: await service.listPurchaseContexts(decodeURIComponent(purchaseContexts[1])) });
      return;
    }
    if (req.method === "POST" && purchaseContexts) {
      sendJson(res, 201, await service.registerPurchaseContext(decodeURIComponent(purchaseContexts[1]), await readJsonBody(req)));
      return;
    }

    const claimableHardwareUnits = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/claimable-hardware-units$`));
    if (req.method === "GET" && claimableHardwareUnits) {
      sendJson(res, 200, { items: await service.listClaimableHardwareUnits(decodeURIComponent(claimableHardwareUnits[1])) });
      return;
    }

    const hardwareUnitClaims = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/hardware-unit-claims$`));
    if (req.method === "POST" && hardwareUnitClaims) {
      sendJson(res, 201, await service.claimHardwareUnit(decodeURIComponent(hardwareUnitClaims[1]), await readJsonBody(req)));
      return;
    }

    const connectivity = path.match(new RegExp(`^${prefix}/devices/([^/]+)/connectivity/status$`));
    if (req.method === "POST" && connectivity) {
      sendJson(res, 200, await service.updateConnectivity(decodeURIComponent(connectivity[1]), await readJsonBody(req)));
      return;
    }

    const support = path.match(new RegExp(`^${prefix}/devices/([^/]+)/support-entitlement$`));
    if (req.method === "GET" && support) {
      sendJson(res, 200, await service.supportEntitlement(decodeURIComponent(support[1])));
      return;
    }

    const accountSupport = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/devices/([^/]+)/support-entitlement$`));
    if (req.method === "GET" && accountSupport) {
      sendJson(res, 200, await service.accountDeviceSupportEntitlement(decodeURIComponent(accountSupport[1]), decodeURIComponent(accountSupport[2])));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/admin/devices`) {
      sendJson(res, 200, { items: await service.adminListDevices(Object.fromEntries(url.searchParams.entries())) });
      return;
    }

    const adminDevice = path.match(new RegExp(`^${prefix}/admin/devices/([^/]+)$`));
    if (req.method === "GET" && adminDevice) {
      sendJson(res, 200, await service.adminDevice(decodeURIComponent(adminDevice[1]), Object.fromEntries(url.searchParams.entries())));
      return;
    }

    const adminDeviceStatus = path.match(new RegExp(`^${prefix}/admin/devices/([^/]+)/status$`));
    if (req.method === "GET" && adminDeviceStatus) {
      sendJson(res, 200, await service.getStatus(decodeURIComponent(adminDeviceStatus[1])));
      return;
    }

    const adminCredentials = path.match(new RegExp(`^${prefix}/admin/devices/([^/]+)/credentials$`));
    if (req.method === "GET" && adminCredentials) {
      sendJson(res, 200, await service.adminCredentials(decodeURIComponent(adminCredentials[1])));
      return;
    }

    const adminSupport = path.match(new RegExp(`^${prefix}/admin/devices/([^/]+)/support-entitlement$`));
    if (req.method === "GET" && adminSupport) {
      sendJson(res, 200, await service.supportEntitlement(decodeURIComponent(adminSupport[1])));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/customer-data-access/consents`) {
      sendJson(res, 201, await service.createConsent(await readJsonBody(req)));
      return;
    }

    const consent = path.match(new RegExp(`^${prefix}/customer-data-access/consents/([^/]+)$`));
    if (req.method === "GET" && consent) {
      sendJson(res, 200, await service.getConsent(decodeURIComponent(consent[1])));
      return;
    }

    const revokeConsent = path.match(new RegExp(`^${prefix}/customer-data-access/consents/([^/]+)/revoke$`));
    if (req.method === "POST" && revokeConsent) {
      sendJson(res, 200, await service.revokeConsent(decodeURIComponent(revokeConsent[1])));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/customer-data-access/audit-events`) {
      sendJson(res, 200, { items: await service.auditEvents({ account_id: url.searchParams.get("accountId") || url.searchParams.get("account_id") || "" }) });
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
}

function authorizeRequest(req, url, signingKey) {
  const path = url.pathname;
  // Challenge and proof are the device authentication protocol itself.
  if (/\/devices\/[^/]+\/auth\/(challenge|verify)$/.test(path)) return;
  const { scope, accountId } = accessRule(req.method, path, url);
  verifyInternalToken(readBearerToken(req), signingKey, {
    audience: "device-management-server", requiredScopes: [scope],
  });
  if (accountId) {
    const delegation = verifyDelegation(req.headers["x-gernetix-delegation"], signingKey, {
      audience: "device-management-server", requiredScopes: [scope],
    });
    assertDelegatedResource(delegation, { accountId });
  }
}

function accessRule(method, path, url) {
  const account = path.match(/^\/api\/device-management\/accounts\/([^/]+)\//);
  if (account) {
    const write = method !== "GET";
    const family = path.includes("board-configurations") ? "account_board"
      : path.includes("purchase-contexts") ? "purchase_context"
        : path.includes("hardware-unit-claims") || path.includes("claimable-hardware-units") ? "hardware_claim"
          : "device.account";
    return { scope: `${family}.${write ? "write" : "read"}`, accountId: decodeURIComponent(account[1]) };
  }
  if (path.includes("/admin/devices")) return { scope: "device.admin.read" };
  if (path.includes("/customer-data-access/")) {
    const accountId = url.searchParams.get("accountId") || url.searchParams.get("account_id") || "";
    return { scope: method === "GET" ? "customer_data_access.read" : "customer_data_access.write", accountId };
  }
  if (path.endsWith("/push-recipients")) return { scope: "device.ownership.resolve" };
  if (path.endsWith("/voice-authorize")) return { scope: "device.voice.authorize" };
  if (path.includes("/pairing/")) return { scope: "device.pair" };
  if (path.includes("/provisioning/")) return { scope: "device.provision" };
  if (path.endsWith("/devices/register")) return { scope: "device.register" };
  if (path.endsWith("/heartbeat") || path.endsWith("/connectivity/status")) return { scope: "device.status.write" };
  return { scope: "device.status.read" };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new DeviceManagementError("request_too_large", "Request ist zu gross.", 413));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new DeviceManagementError("invalid_json", "Request Body ist kein gueltiges JSON."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

module.exports = { createHttpApp, sendJson };
