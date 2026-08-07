"use strict";

const path = require("node:path");

function registerWebRoutes({
  registry, requireSession, redirect, authRoute, serveStatic, normalizeAppPath,
  appDir, operatorShellDir, publicDir, serveVendorEsptool, proxyPublicDemo,
}) {
  registry.register({ method: "*", path: "/app/manifest.webmanifest", handler: ({ res }) => serveStatic(res, appDir, "/manifest.webmanifest") });
  registry.register({ method: "*", path: "/app/push-sw.js", handler: ({ res }) => serveStatic(res, appDir, "/push-sw.js") });
  registry.register({ method: "*", path: "/app/operator-shell.css", handler: ({ res, url }) => serveStatic(res, operatorShellDir, "/operator-shell.css", { versioned: url.searchParams.has("v") }) });
  registry.register({ method: "GET", pattern: /^\/vendor\/esptool-js\//, handler: ({ res, url }) => serveVendorEsptool(res, url.pathname) });
  registry.register({ method: "*", path: "/s3-touch-spielesammlung", handler: ({ res }) => redirect(res, "/s3-touch-spielesammlung/") });
  registry.register({
    method: "GET",
    pattern: /^\/s3-touch-spielesammlung\//,
    handler: ({ res, url }) => proxyPublicDemo(res, `${url.pathname.slice("/s3-touch-spielesammlung".length)}${url.search}`),
  });
  registry.register({
    method: "*",
    pattern: /^\/demos(?:\/|$)/,
    handler: ({ res, url }) => redirect(res, `/s3-touch-spielesammlung/${url.pathname.slice("/demos/".length)}${url.search}`),
  });
  for (const routePath of ["/demo", "/demo/", "/projects", "/projects/"]) {
    registry.register({ method: "*", path: routePath, handler: ({ res }) => redirect(res, "/app/dashboard/") });
  }
  for (const routePath of ["/app", "/app/"]) {
    registry.register({
      method: "*",
      path: routePath,
      async handler({ req, res }) {
        if (!await requireSession(req, null)) { redirect(res, authRoute("/app/dashboard/")); return; }
        redirect(res, "/app/dashboard/");
      },
    });
  }
  for (const routePath of ["/login.html", "/login.js", "/styles.css"]) {
    registry.register({ method: "*", path: routePath, handler: ({ res, url }) => redirect(res, authRoute(url.searchParams.get("next") || "/app/dashboard/")) });
  }
  registry.register({ method: "*", pattern: /^\/app\/auth(?:\/|$)/, handler: ({ res, url }) => serveStatic(res, appDir, normalizeAppPath(url.pathname), { versioned: url.searchParams.has("v") }) });
  for (const routePath of ["/hilfe", "/hilfe/", "/wissen", "/wissen/"]) {
    registry.register({ method: "*", path: routePath, handler: ({ res }) => serveStatic(res, appDir, "/index.html") });
  }
  for (const routePath of ["/ueber-uns", "/ueber-uns/"]) {
    registry.register({ method: "*", path: routePath, handler: ({ res }) => serveStatic(res, path.join(publicDir, "ueber-uns"), "/index.html") });
  }
  registry.register({
    method: "*",
    pattern: /^\/app\/dashboard(?:\/|$)/,
    async handler({ req, res, url }) {
      if (!await requireSession(req, null)) { redirect(res, authRoute(url.pathname + url.search)); return; }
      serveStatic(res, appDir, "/index.html");
    },
  });
  registry.register({
    method: "*",
    pattern: /^\/app\/.*\.[^/]+$/,
    handler: ({ res, url }) => serveStatic(res, appDir, normalizeAppPath(url.pathname), { versioned: url.searchParams.has("v") }),
  });
  registry.register({
    method: "*",
    pattern: /^\/app\//,
    async handler({ req, res, url }) {
      if (!await requireSession(req, null)) { redirect(res, authRoute(url.pathname + url.search)); return; }
      serveStatic(res, appDir, normalizeAppPath(url.pathname));
    },
  });
  registry.register({
    method: "*",
    pattern: /^\/projects\//,
    async handler({ req, res, url }) {
      if (!await requireSession(req, null)) { redirect(res, authRoute(url.pathname + url.search)); return; }
      redirect(res, "/app/dashboard/");
    },
  });
  registry.register({
    method: "*",
    pattern: /^\/dev\/projects(?:\/|$)/,
    async handler({ req, res }) {
      if (!await requireSession(req, null)) { redirect(res, authRoute("/app/learn/")); return; }
      redirect(res, "/app/learn/");
    },
  });
  for (const routePath of ["/shop", "/shop/"]) registry.register({ method: "*", path: routePath, handler: ({ res }) => serveStatic(res, publicDir, "/shop/index.html") });
  for (const routePath of ["/tarife", "/tarife/"]) registry.register({ method: "*", path: routePath, handler: ({ res }) => serveStatic(res, publicDir, "/tarife/index.html") });
  for (const routePath of ["/entdecken", "/entdecken/", "/downloads", "/downloads/"]) registry.register({ method: "*", path: routePath, handler: ({ res }) => redirect(res, "/nachbauprojekte/") });
  for (const routePath of ["/nachbauprojekte", "/nachbauprojekte/"]) registry.register({ method: "*", path: routePath, handler: ({ res }) => serveStatic(res, publicDir, "/nachbauprojekte/index.html") });
  registry.register({ method: "*", path: "/nachbauprojekte/einfache-elektromotoren", handler: ({ res }) => redirect(res, "/nachbauprojekte/einfache-elektromotoren/") });
  registry.register({ method: "*", path: "/nachbauprojekte/einfache-elektromotoren/", handler: ({ res }) => serveStatic(res, publicDir, "/nachbauprojekte/einfache-elektromotoren/index.html") });
  registry.register({ method: "*", path: "/nachbauprojekte/druckmotoren", handler: ({ res }) => redirect(res, "/nachbauprojekte/druckmotoren/") });
  registry.register({ method: "*", path: "/nachbauprojekte/druckmotoren/", handler: ({ res }) => serveStatic(res, publicDir, "/nachbauprojekte/druckmotoren/index.html") });
  registry.register({ method: "*", path: "/nachbauprojekte/hw364a-spielesammlung", handler: ({ res }) => redirect(res, "/nachbauprojekte/hw364a-spielesammlung/") });
  registry.register({ method: "*", path: "/nachbauprojekte/hw364a-spielesammlung/", handler: ({ res }) => serveStatic(res, publicDir, "/nachbauprojekte/hw364a-spielesammlung/index.html") });
  registry.register({ method: "*", path: "/nachbauprojekte/nexi-sprachassistent", handler: ({ res }) => redirect(res, "/nachbauprojekte/nexi-sprachassistent/") });
  registry.register({ method: "*", path: "/nachbauprojekte/nexi-sprachassistent/", handler: ({ res }) => serveStatic(res, publicDir, "/nachbauprojekte/nexi-sprachassistent/index.html") });
  registry.register({ method: "*", path: "/nachbauprojekte/nexi-sprachassistent/inbetriebnahme", handler: ({ res }) => redirect(res, "/nachbauprojekte/nexi-sprachassistent/inbetriebnahme/") });
  registry.register({ method: "*", path: "/nachbauprojekte/nexi-sprachassistent/inbetriebnahme/", handler: ({ res }) => serveStatic(res, publicDir, "/nachbauprojekte/nexi-sprachassistent/inbetriebnahme/index.html") });
  registry.register({
    method: "GET",
    pattern: /^\/nachbauprojekte\/nexi-sprachassistent\/api\//,
    handler: ({ res, url }) => proxyPublicDemo(res, `${url.pathname.slice("/nachbauprojekte/nexi-sprachassistent".length)}${url.search}`),
  });
  for (const routePath of ["/community", "/community/"]) registry.register({ method: "*", path: routePath, handler: ({ res }) => serveStatic(res, publicDir, "/community/index.html") });
  for (const routePath of ["/support", "/support/"]) registry.register({ method: "*", path: routePath, handler: ({ res }) => serveStatic(res, publicDir, "/support/index.html") });
  registry.register({ method: "*", pattern: /^\/community\/questions\/[^/]+\/?$/, handler: ({ res }) => serveStatic(res, publicDir, "/community/question.html") });
  for (const routePath of ["/flashbox-einrichten", "/flashbox-einrichten/"]) registry.register({ method: "*", path: routePath, handler: ({ res }) => serveStatic(res, publicDir, "/flashbox-einrichten/index.html") });
  registry.register({ method: "*", path: "/", handler: ({ res }) => serveStatic(res, publicDir, "/index.html") });
  registry.register({ method: "*", pattern: /^\//, handler: ({ res, url }) => serveStatic(res, publicDir, url.pathname) });
}

module.exports = { registerWebRoutes };
