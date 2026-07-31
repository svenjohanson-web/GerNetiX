"use strict";

function createRouteRegistry() {
  const routes = [];

  function register({ method, path, pattern, handler }) {
    if (!method || (!path && !pattern) || typeof handler !== "function") {
      throw new TypeError("method, path or pattern, and handler are required");
    }
    routes.push({ method: String(method).toUpperCase(), path, pattern, handler });
  }

  async function dispatch({ req, res, url }) {
    const requestMethod = String(req.method || "GET").toUpperCase();
    for (const route of routes) {
      if (route.method !== "*" && route.method !== requestMethod) continue;
      if (route.path && route.path !== url.pathname) continue;
      const match = route.pattern ? url.pathname.match(route.pattern) : null;
      if (route.pattern && !match) continue;
      await route.handler({ req, res, url, match });
      return true;
    }
    return false;
  }

  return { register, dispatch };
}

module.exports = { createRouteRegistry };
