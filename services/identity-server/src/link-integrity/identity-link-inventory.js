"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const identityRoutes = [
  route("identity.home", "/", "public", "Identity"),
  route("identity.about", "/ueber-uns/", "public", "Business"),
  route("identity.rebuild_projects", "/nachbauprojekte/", "public", "Learning"),
  route("identity.motor_rebuild", "/nachbauprojekte/einfache-elektromotoren/", "public", "Learning"),
  route("identity.printed_motor_series", "/nachbauprojekte/druckmotoren/", "public", "Learning"),
  route("identity.nexi_rebuild", "/nachbauprojekte/nexi-sprachassistent/", "public", "Learning"),
  route("identity.radar_room_presence_rebuild", "/nachbauprojekte/radar-raumpraesenz/", "public", "Learning"),
  route("identity.flashbox_setup", "/flashbox-einrichten/", "public", "DeviceManagement"),
  route("identity.knowledge", "/wissen/", "public", "Learning"),
  route("identity.community", "/community/", "public", "Community"),
  route("identity.help", "/hilfe/", "public", "Identity"),
  route("identity.support", "/support/", "public", "Identity"),
  route("identity.shop", "/shop/", "public", "Business"),
  route("identity.auth", "/app/auth/", "public", "Identity"),
  route("identity.dashboard", "/app/dashboard/", "authenticated", "Identity"),
  route("identity.applications", "/app/applications/", "authenticated", "Project"),
  route("identity.internal_about", "/app/about/", "authenticated", "Business"),
  route("identity.learning", "/app/learn/", "authenticated", "Learning"),
  route("identity.development", "/app/development-platform/", "authenticated", "IDE"),
  route("identity.development_hardware", "/app/development-platform/hardware/", "authenticated", "Hardware"),
  route("identity.ide", "/app/ide/", "authenticated", "IDE"),
  route("identity.projects", "/app/projects/", "authenticated", "Project"),
  route("identity.devices", "/app/devices/", "authenticated", "DeviceManagement"),
  route("identity.device_provisioning", "/app/device-management/provisioning/", "authenticated", "DeviceManagement"),
  route("identity.device_inventory", "/app/device-management/inventory/", "authenticated", "DeviceManagement"),
  route("identity.device_recovery", "/app/device-management/recovery/", "authenticated", "DeviceManagement"),
  route("identity.builds", "/app/builds/", "authenticated", "Project"),
  route("identity.downloads", "/app/downloads/", "authenticated", "Identity"),
  route("identity.billing", "/app/billing/", "authenticated", "Business"),
  route("identity.account_setup", "/app/account-setup/", "authenticated", "Account"),
  route("identity.internal_community", "/app/community/", "authenticated", "Community"),
];

function createIdentityLinkInventory(options = {}) {
  const publicDir = path.resolve(options.publicDir || path.join(__dirname, "..", "..", "public"));
  const generatedAt = options.generatedAt || new Date().toISOString();
  const targets = new Map(identityRoutes.map((item) => [item.reference_id, item]));
  const targetKeyToId = new Map(identityRoutes.map((item) => [targetKey(item.target_url, item.access_scope), item.reference_id]));
  const occurrences = [];

  for (const definition of identityRoutes) {
    occurrences.push(occurrence(definition.reference_id, "identity-route-registry", definition.target_url));
  }

  for (const filePath of walkSourceFiles(publicDir)) {
    const relativePath = path.relative(publicDir, filePath).split(path.sep).join("/");
    const sourceRoute = routeForPublicFile(relativePath);
    const content = fs.readFileSync(filePath, "utf8");
    for (const rawTarget of extractLinkValues(content)) {
      const normalized = normalizeTarget(rawTarget, sourceRoute);
      if (!normalized) continue;
      const accessScope = inferAccessScope(normalized);
      const key = targetKey(normalized, accessScope);
      let referenceId = targetKeyToId.get(key);
      if (!referenceId) {
        referenceId = `identity.link.${hash(key)}`;
        targetKeyToId.set(key, referenceId);
        targets.set(referenceId, {
          reference_id: referenceId,
          target_url: normalized,
          link_type: inferLinkType(normalized),
          owner_domain: inferOwnerDomain(normalized),
          access_scope: accessScope,
          source_service: "identity-server",
          active: true,
        });
      }
      occurrences.push(occurrence(referenceId, relativePath, sourceRoute));
    }
  }

  return {
    schema_version: 1,
    source_service: "identity-server",
    generated_at: generatedAt,
    targets: [...targets.values()].sort((left, right) => left.target_url.localeCompare(right.target_url)),
    occurrences: deduplicateOccurrences(occurrences),
  };
}

function route(referenceId, targetUrl, accessScope, ownerDomain) {
  return {
    reference_id: referenceId,
    target_url: targetUrl,
    link_type: "internal",
    owner_domain: ownerDomain,
    access_scope: accessScope,
    source_service: "identity-server",
    active: true,
  };
}

function occurrence(referenceId, sourceLocation, sourceRoute) {
  const key = `${referenceId}\n${sourceLocation}\n${sourceRoute}`;
  return {
    occurrence_id: `identity.occurrence.${hash(key, 24)}`,
    reference_id: referenceId,
    source_service: "identity-server",
    source_location: sourceLocation,
    source_route: sourceRoute,
  };
}

function walkSourceFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) files.push(...walkSourceFiles(fullPath));
    else if (entry.isFile() && /\.(?:html?|js|css)$/i.test(entry.name)) files.push(fullPath);
  }
  return files.sort();
}

function extractLinkValues(content) {
  const values = [];
  const patterns = [
    /\b(?:href|src|action)\s*=\s*["']([^"'<>]+)["']/gi,
    /\burl\(\s*["']?([^"')\s]+)["']?\s*\)/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content))) values.push(match[1]);
  }
  return values;
}

function normalizeTarget(rawTarget, sourceRoute) {
  const value = String(rawTarget || "").trim();
  if (!value || value.includes("${") || value.includes("<%")) return "";
  if (/^(?:javascript|data|blob):/i.test(value)) return "";
  if (/^(?:mailto|tel):/i.test(value)) return value;
  if (value.startsWith("#")) return `${sourceRoute.split("#")[0]}${value}`;
  try {
    const resolved = new URL(value, `https://gernetix.invalid${sourceRoute}`);
    if (resolved.origin === "https://gernetix.invalid") {
      return `${resolved.pathname}${resolved.search}${resolved.hash}`;
    }
    return resolved.href;
  } catch {
    return "";
  }
}

function routeForPublicFile(relativePath) {
  if (relativePath === "index.html") return "/";
  if (relativePath.endsWith("/index.html")) return `/${relativePath.slice(0, -"index.html".length)}`;
  return `/${relativePath}`;
}

function inferLinkType(targetUrl) {
  if (/^(?:mailto|tel):/i.test(targetUrl)) return "contact";
  if (/^https?:\/\//i.test(targetUrl)) return /\.local(?::\d+)?(?:\/|$)/i.test(targetUrl) ? "local_device" : "external";
  return "internal";
}

function inferAccessScope(targetUrl) {
  if (/^https?:\/\/[^/]*\.local(?::\d+)?(?:\/|$)/i.test(targetUrl)) return "local_device";
  if (targetUrl.startsWith("/app/") && !targetUrl.startsWith("/app/auth/")) return "authenticated";
  if (targetUrl.startsWith("/downloads/usb-serial-helper/")) return "authenticated";
  return "public";
}

function inferOwnerDomain(targetUrl) {
  if (/device-management|flashbox|provision/i.test(targetUrl)) return "DeviceManagement";
  if (/knowledge|wissen|learn|nachbauprojekte/i.test(targetUrl)) return "Learning";
  if (/community/i.test(targetUrl)) return "Community";
  if (/shop|billing/i.test(targetUrl)) return "Business";
  if (/ide|development-platform|projects|builds/i.test(targetUrl)) return "IDE";
  return "Identity";
}

function targetKey(targetUrl, accessScope) {
  return `${accessScope}\n${targetUrl}`;
}

function hash(value, length = 16) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, length);
}

function deduplicateOccurrences(items) {
  return [...new Map(items.map((item) => [item.occurrence_id, item])).values()]
    .sort((left, right) => left.source_location.localeCompare(right.source_location));
}

module.exports = {
  createIdentityLinkInventory,
  extractLinkValues,
  identityRoutes,
  normalizeTarget,
};
