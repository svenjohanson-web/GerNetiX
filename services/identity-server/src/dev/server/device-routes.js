"use strict";

function registerDeviceRoutes({
  registry,
  requireSession,
  sendJson,
  discoverNetworkDevices,
  handleDeviceConnectivityCheck,
  listUsbSerialPorts,
  handlePlatformDiscoveredDeviceClaim,
  handlePlatformDeviceCreate,
  handlePlatformDeviceBasissoftwareProfileUpdate,
  handlePlatformDeviceRemove,
  handlePlatformProvisioningSession,
  handlePlatformProvisioningComplete,
  loadUserIdeDevices,
  handleDeviceRecoveryFirmwareCheck,
  handlePlatformFlashboxClaim,
}) {
  registry.register({
    method: "GET",
    path: "/api/platform/devices/discover",
    async handler({ req, res, url }) {
      const session = await requireSession(req, res);
      if (session) sendJson(res, 200, await discoverNetworkDevices(session, Object.fromEntries(url.searchParams.entries())));
    },
  });
  registry.register({
    method: "POST",
    pattern: /^\/api\/user-ide\/devices\/([^/]+)\/connectivity-check$/,
    async handler({ req, res, match }) {
      const session = await requireSession(req, res);
      if (session) await handleDeviceConnectivityCheck(res, session, decodeURIComponent(match[1]));
    },
  });
  registry.register({
    method: "GET",
    path: "/api/platform/usb-serial/ports",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (session) sendJson(res, 200, { items: await listUsbSerialPorts() });
    },
  });

  for (const [path, handler] of [
    ["/api/platform/devices/from-discovery", handlePlatformDiscoveredDeviceClaim],
    ["/api/platform/devices", handlePlatformDeviceCreate],
    ["/api/platform/provisioning/session", handlePlatformProvisioningSession],
    ["/api/platform/provisioning/complete", handlePlatformProvisioningComplete],
  ]) {
    registry.register({
      method: "POST",
      path,
      async handler({ req, res }) {
        const session = await requireSession(req, res);
        if (session) await handler(req, res, session);
      },
    });
  }
  registry.register({
    method: "PUT",
    pattern: /^\/api\/platform\/devices\/([^/]+)$/,
    async handler({ req, res, match }) {
      const session = await requireSession(req, res);
      if (session) await handlePlatformDeviceBasissoftwareProfileUpdate(req, res, session, decodeURIComponent(match[1]));
    },
  });
  registry.register({
    method: "DELETE",
    pattern: /^\/api\/platform\/devices\/([^/]+)$/,
    async handler({ req, res, match }) {
      const session = await requireSession(req, res);
      if (session) await handlePlatformDeviceRemove(res, session, decodeURIComponent(match[1]));
    },
  });
  registry.register({
    method: "*",
    path: "/api/user-ide/devices",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (session) sendJson(res, 200, { items: await loadUserIdeDevices(session) });
    },
  });
  registry.register({
    method: "POST",
    path: "/api/user-ide/device-recovery/check-firmware",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (session) await handleDeviceRecoveryFirmwareCheck(req, res, session);
    },
  });
  registry.register({
    method: "POST",
    path: "/api/platform/flashbox/claim",
    async handler({ req, res }) {
      const session = await requireSession(req, res);
      if (session) await handlePlatformFlashboxClaim(req, res, session);
    },
  });
}

module.exports = { registerDeviceRoutes };
