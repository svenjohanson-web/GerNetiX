"use strict";

const PATHS = Object.freeze({
  protectedDashboard: "/app/dashboard/",
  auth: "/app/auth/",
  projectList: "/app/learn/",
});

const SELECTORS = Object.freeze({
  loginTitle: "#login-title",
  loginForm: "#login-form",
  showIdentifierLogin: "#show-identifier-login",
  loginIdentifier: "#login-identifier",
  loginStatus: "#status",
  projectList: "#projectList",
  projectCard: "#projectList [data-open-learning-project-overview]",
  projectDetail: "#learningProjectOverview .learning-project-overview-head h2",
});

function appUrl(baseUrl, pathname) {
  return new URL(pathname, baseUrl).href;
}

function isAuthPath(url) {
  return new URL(url).pathname.startsWith(PATHS.auth);
}

function redactedResult(result) {
  return {
    ok: result.ok === true,
    scenarios: Array.isArray(result.scenarios) ? [...result.scenarios] : [],
    target: result.target ? new URL(result.target).origin : undefined,
  };
}

module.exports = { PATHS, SELECTORS, appUrl, isAuthPath, redactedResult };
