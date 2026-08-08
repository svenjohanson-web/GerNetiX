import http from "k6/http";
import { check, group, sleep } from "k6";
import { Rate } from "k6/metrics";
import exec from "k6/execution";
import { buildConfig, credentialsForVu } from "./lib/config.js";
import { ROUTES, compactSummary, selectProject, settingUpdate } from "./lib/contracts.js";

const config = buildConfig(__ENV);
const flowFailures = new Rate("flow_failures");

export const options = config.options;

let authenticated = false;

export default function authenticatedProjectFlow() {
  const vu = exec.vu.idInTest;
  const credentials = credentialsForVu(config, vu);

  if (!authenticated && !login(credentials)) return;
  if (!readSession(credentials.username)) return;

  const projects = readProjectList();
  if (!projects) return;
  const project = selectProject(projects, { projectId: config.projectId, requireProjectApp: config.saveSettings });
  if (!record(Boolean(project), "project list contains a selectable project")) return;
  if (!readProjectDetail(project.id)) return;
  if (config.saveSettings && !saveProjectSetting(project)) return;

  sleep(config.pauseSeconds);
}

function login(credentials) {
  return group("identity login", () => {
    const response = http.post(url(ROUTES.login), JSON.stringify({
      identifier: credentials.username,
      password: credentials.password,
      locale: "de",
    }), requestParams("login", "POST"));
    const payload = responseJson(response);
    const ok = record(response.status === 200, "login returns 200")
      && record(Boolean(payload?.account), "login returns an account");
    authenticated = ok;
    return ok;
  });
}

function readSession(expectedUsername) {
  return group("identity session", () => {
    const response = http.get(url(ROUTES.session), requestParams("session", "GET"));
    const payload = responseJson(response);
    return record(response.status === 200, "session returns 200")
      && record(payload?.authenticated === true, "session is authenticated")
      && record(!payload?.account?.username || payload.account.username === expectedUsername, "session belongs to the expected account");
  });
}

function readProjectList() {
  return group("project list", () => {
    const response = http.get(url(ROUTES.projectList), requestParams("project_list", "GET"));
    const payload = responseJson(response);
    const ok = record(response.status === 200, "project list returns 200")
      && record(Array.isArray(payload?.projects), "project list returns projects");
    return ok ? payload.projects : null;
  });
}

function readProjectDetail(projectId) {
  return group("project detail", () => {
    const response = http.get(url(ROUTES.projectDetail(projectId)), requestParams("project_detail", "GET", { project_id: projectId }));
    const payload = responseJson(response);
    return record(response.status === 200, "project detail returns 200")
      && record(payload?.project?.id === projectId, "project detail matches the selected project");
  });
}

function saveProjectSetting(project) {
  return group("project settings CAS", () => {
    const route = ROUTES.projectApp(project.id);
    const readResponse = http.get(url(route), requestParams("project_settings_read", "GET", { project_id: project.id }));
    const snapshot = responseJson(readResponse);
    if (!record(readResponse.status === 200, "project settings return 200")) return false;

    let body;
    try {
      body = settingUpdate(snapshot, config);
    } catch (error) {
      console.error(`Cannot build settings update: ${error.message}`);
      record(false, "project settings snapshot supports CAS update");
      return false;
    }

    const actionId = actionUuid();
    const writeResponse = http.put(url(route), JSON.stringify(body), requestParams("project_settings_save", "PUT", {
      project_id: project.id,
      action_type: "project.settings.save",
    }, {
      "X-GerNetiX-Action-Id": actionId,
      "X-GerNetiX-Action-Type": "project.settings.save",
    }));
    const saved = responseJson(writeResponse);
    return record(writeResponse.status === 200, "project settings save returns 200")
      && record(Number(saved?.revision) === Number(snapshot.revision) + 1, "project settings revision advances exactly once");
  });
}

function requestParams(endpoint, method, tags = {}, headers = {}) {
  return {
    headers: method === "GET" ? headers : { "Content-Type": "application/json", ...headers },
    tags: { endpoint, operation: method, ...tags },
    timeout: "30s",
  };
}

function responseJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

function record(condition, name) {
  const ok = check(null, { [name]: () => Boolean(condition) });
  flowFailures.add(!ok, { check: name });
  return ok;
}

function url(path) {
  return `${config.baseUrl}${path}`;
}

function actionUuid() {
  const vu = String(exec.vu.idInTest).padStart(4, "0").slice(-4);
  const iteration = String(exec.scenario.iterationInTest).padStart(8, "0").slice(-8);
  return `00000000-0000-4000-8000-${vu}${iteration}`;
}

export function handleSummary(data) {
  const summary = compactSummary(data, { profile: config.profile });
  const serialized = `${JSON.stringify(summary, null, 2)}\n`;
  return config.summaryPath ? { stdout: serialized, [config.summaryPath]: serialized } : { stdout: serialized };
}
