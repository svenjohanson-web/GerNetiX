export const ROUTES = Object.freeze({
  login: "/api/login",
  session: "/api/session",
  projectList: "/api/platform/bootstrap?include=projects",
  projectDetail(projectId) {
    return `/api/platform/projects/${encodeURIComponent(projectId)}`;
  },
  projectApp(projectId) {
    return `/api/platform/projects/${encodeURIComponent(projectId)}/project-app`;
  },
});

export function selectProject(projects, { projectId = "", requireProjectApp = false } = {}) {
  if (!Array.isArray(projects)) return null;
  if (projectId) return projects.find((project) => project?.id === projectId) || null;
  const eligible = projects.filter((project) => project && typeof project.id === "string" && project.id);
  if (requireProjectApp) {
    return eligible.find((project) => project.hasProjectApp === true && project.status !== "plan_locked")
      || eligible.find((project) => project.hasProjectApp === true)
      || null;
  }
  return eligible.find((project) => project.projectOrigin === "account_project" && project.status !== "plan_locked")
    || eligible.find((project) => project.projectOrigin === "account_project")
    || eligible[0]
    || null;
}

export function settingUpdate(snapshot, config) {
  if (!snapshot || typeof snapshot !== "object") throw new Error("Project-app snapshot is missing");
  if (!Number.isSafeInteger(Number(snapshot.revision)) || Number(snapshot.revision) < 0) {
    throw new Error("Project-app snapshot has no valid revision");
  }
  if (snapshot.manifest_version === undefined || snapshot.manifest_version === null) {
    throw new Error("Project-app snapshot has no manifest_version");
  }
  const currentValues = snapshot.values && typeof snapshot.values === "object" && !Array.isArray(snapshot.values)
    ? snapshot.values
    : {};
  const hasConfiguredValue = config.settingValue !== undefined;
  if (!hasConfiguredValue && !Object.hasOwn(currentValues, config.settingKey)) {
    throw new Error(`SETTING_VALUE is required because ${config.settingKey} has no current value`);
  }
  return {
    manifest_version: snapshot.manifest_version,
    expected_revision: Number(snapshot.revision),
    values: {
      [config.settingKey]: hasConfiguredValue ? config.settingValue : currentValues[config.settingKey],
    },
  };
}

export function compactSummary(data, metadata = {}) {
  const metrics = {};
  for (const [name, metric] of Object.entries(data?.metrics || {})) {
    metrics[name] = {
      type: metric.type,
      contains: metric.contains,
      values: metric.values || {},
      thresholds: metric.thresholds || {},
    };
  }
  return {
    schema_version: 1,
    suite: "gernetix-system-tests",
    scenario: "authenticated-project-flow",
    profile: metadata.profile || "",
    generated_at: metadata.generatedAt || new Date().toISOString(),
    state: data?.state || {},
    metrics,
    checks: flattenChecks(data?.root_group),
  };
}

function flattenChecks(group, path = []) {
  if (!group) return [];
  const currentPath = group.name ? path.concat(group.name) : path;
  const checks = (group.checks || []).map((check) => ({
    group: currentPath.join(" / "),
    name: check.name,
    passes: check.passes,
    fails: check.fails,
  }));
  for (const child of group.groups || []) checks.push(...flattenChecks(child, currentPath));
  return checks;
}
