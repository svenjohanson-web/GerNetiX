const { DeviceManagementError } = require("./errors");

const prefix = "/api/device-management";

function createHttpApp(options) {
  const service = options.service;

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

    if (req.method === "POST" && path === `${prefix}/devices/register`) {
      sendJson(res, 201, service.registerDevice(await readJsonBody(req)));
      return;
    }

    const heartbeat = path.match(new RegExp(`^${prefix}/devices/([^/]+)/heartbeat$`));
    if (req.method === "POST" && heartbeat) {
      sendJson(res, 200, service.heartbeat(decodeURIComponent(heartbeat[1]), await readJsonBody(req)));
      return;
    }

    const status = path.match(new RegExp(`^${prefix}/devices/([^/]+)/status$`));
    if (req.method === "GET" && status) {
      sendJson(res, 200, service.getStatus(decodeURIComponent(status[1])));
      return;
    }

    const pushRecipients = path.match(new RegExp(`^${prefix}/devices/([^/]+)/push-recipients$`));
    if (req.method === "GET" && pushRecipients) {
      sendJson(res, 200, service.pushRecipients(decodeURIComponent(pushRecipients[1])));
      return;
    }

    const challenge = path.match(new RegExp(`^${prefix}/devices/([^/]+)/auth/challenge$`));
    if (req.method === "POST" && challenge) {
      sendJson(res, 201, service.createChallenge(decodeURIComponent(challenge[1])));
      return;
    }

    const verify = path.match(new RegExp(`^${prefix}/devices/([^/]+)/auth/verify$`));
    if (req.method === "POST" && verify) {
      sendJson(res, 200, service.verifyChallenge(decodeURIComponent(verify[1]), await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/pairing/sessions`) {
      sendJson(res, 201, service.createPairingSession(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/provisioning/tokens`) {
      sendJson(res, 201, service.createProvisioningToken(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/provisioning/tokens/consume`) {
      sendJson(res, 200, service.consumeProvisioningToken(await readJsonBody(req)));
      return;
    }

    const pairing = path.match(new RegExp(`^${prefix}/pairing/sessions/([^/]+)$`));
    if (req.method === "GET" && pairing) {
      sendJson(res, 200, service.getPairingSession(decodeURIComponent(pairing[1])));
      return;
    }

    const pairingComplete = path.match(new RegExp(`^${prefix}/pairing/sessions/([^/]+)/complete$`));
    if (req.method === "POST" && pairingComplete) {
      sendJson(res, 200, service.completePairing(decodeURIComponent(pairingComplete[1]), await readJsonBody(req)));
      return;
    }

    const pairingCancel = path.match(new RegExp(`^${prefix}/pairing/sessions/([^/]+)/cancel$`));
    if (req.method === "POST" && pairingCancel) {
      sendJson(res, 200, service.cancelPairing(decodeURIComponent(pairingCancel[1])));
      return;
    }

    const accountDevices = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/devices$`));
    if (req.method === "GET" && accountDevices) {
      sendJson(res, 200, { items: service.listAccountDevices(decodeURIComponent(accountDevices[1])) });
      return;
    }
    if (req.method === "POST" && accountDevices) {
      sendJson(res, 201, service.addAccountDevice(decodeURIComponent(accountDevices[1]), await readJsonBody(req)));
      return;
    }

    const accountDevice = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/devices/([^/]+)$`));
    if (req.method === "PUT" && accountDevice) {
      sendJson(res, 200, service.updateAccountDeviceBasissoftwareProfile(
        decodeURIComponent(accountDevice[1]),
        decodeURIComponent(accountDevice[2]),
        await readJsonBody(req),
      ));
      return;
    }
    if (req.method === "DELETE" && accountDevice) {
      sendJson(res, 200, service.removeAccountDevice(decodeURIComponent(accountDevice[1]), decodeURIComponent(accountDevice[2])));
      return;
    }

    const otaTargets = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/ota-targets$`));
    if (req.method === "GET" && otaTargets) {
      sendJson(res, 200, {
        items: service.otaTargets(decodeURIComponent(otaTargets[1]), Object.fromEntries(url.searchParams.entries())),
      });
      return;
    }

    const purchaseContexts = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/purchase-contexts$`));
    if (req.method === "GET" && purchaseContexts) {
      sendJson(res, 200, { items: service.listPurchaseContexts(decodeURIComponent(purchaseContexts[1])) });
      return;
    }
    if (req.method === "POST" && purchaseContexts) {
      sendJson(res, 201, service.registerPurchaseContext(decodeURIComponent(purchaseContexts[1]), await readJsonBody(req)));
      return;
    }

    const connectivity = path.match(new RegExp(`^${prefix}/devices/([^/]+)/connectivity/status$`));
    if (req.method === "POST" && connectivity) {
      sendJson(res, 200, service.updateConnectivity(decodeURIComponent(connectivity[1]), await readJsonBody(req)));
      return;
    }

    const support = path.match(new RegExp(`^${prefix}/devices/([^/]+)/support-entitlement$`));
    if (req.method === "GET" && support) {
      sendJson(res, 200, service.supportEntitlement(decodeURIComponent(support[1])));
      return;
    }

    const accountSupport = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/devices/([^/]+)/support-entitlement$`));
    if (req.method === "GET" && accountSupport) {
      sendJson(res, 200, service.accountDeviceSupportEntitlement(decodeURIComponent(accountSupport[1]), decodeURIComponent(accountSupport[2])));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/admin/devices`) {
      sendJson(res, 200, { items: service.adminListDevices(Object.fromEntries(url.searchParams.entries())) });
      return;
    }

    const adminDevice = path.match(new RegExp(`^${prefix}/admin/devices/([^/]+)$`));
    if (req.method === "GET" && adminDevice) {
      sendJson(res, 200, service.adminDevice(decodeURIComponent(adminDevice[1]), Object.fromEntries(url.searchParams.entries())));
      return;
    }

    const adminDeviceStatus = path.match(new RegExp(`^${prefix}/admin/devices/([^/]+)/status$`));
    if (req.method === "GET" && adminDeviceStatus) {
      sendJson(res, 200, service.getStatus(decodeURIComponent(adminDeviceStatus[1])));
      return;
    }

    const adminCredentials = path.match(new RegExp(`^${prefix}/admin/devices/([^/]+)/credentials$`));
    if (req.method === "GET" && adminCredentials) {
      sendJson(res, 200, service.adminCredentials(decodeURIComponent(adminCredentials[1])));
      return;
    }

    const adminSupport = path.match(new RegExp(`^${prefix}/admin/devices/([^/]+)/support-entitlement$`));
    if (req.method === "GET" && adminSupport) {
      sendJson(res, 200, service.supportEntitlement(decodeURIComponent(adminSupport[1])));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/customer-data-access/consents`) {
      sendJson(res, 201, service.createConsent(await readJsonBody(req)));
      return;
    }

    const consent = path.match(new RegExp(`^${prefix}/customer-data-access/consents/([^/]+)$`));
    if (req.method === "GET" && consent) {
      sendJson(res, 200, service.getConsent(decodeURIComponent(consent[1])));
      return;
    }

    const revokeConsent = path.match(new RegExp(`^${prefix}/customer-data-access/consents/([^/]+)/revoke$`));
    if (req.method === "POST" && revokeConsent) {
      sendJson(res, 200, service.revokeConsent(decodeURIComponent(revokeConsent[1])));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/customer-data-access/audit-events`) {
      sendJson(res, 200, { items: service.auditEvents({ account_id: url.searchParams.get("accountId") || url.searchParams.get("account_id") || "" }) });
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
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
