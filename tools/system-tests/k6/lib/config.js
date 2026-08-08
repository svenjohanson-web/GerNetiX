const PROFILE_DEFAULTS = Object.freeze({
  smoke: Object.freeze({
    vus: 10,
    iterations: 10,
    maxDuration: "2m",
    requestTimeoutMs: 5_000,
  }),
  load: Object.freeze({
    vus: 100,
    rampUp: "2m",
    steady: "10m",
    rampDown: "2m",
    requestTimeoutMs: 10_000,
  }),
});

export function buildConfig(env = {}) {
  const profile = enumValue(env.PROFILE || "smoke", ["smoke", "load"], "PROFILE");
  const defaults = PROFILE_DEFAULTS[profile];
  const baseUrl = normalizedBaseUrl(env.BASE_URL || "http://127.0.0.1:14300");
  const saveSettings = booleanValue(env.SAVE_SETTINGS, false);
  const settingKey = String(env.SETTING_KEY || "").trim();
  if (saveSettings && !settingKey) {
    throw new Error("SETTING_KEY is required when SAVE_SETTINGS=true");
  }

  const config = {
    profile,
    baseUrl,
    username: String(env.USERNAME || "").trim(),
    usernameTemplate: String(env.USERNAME_TEMPLATE || "").trim(),
    password: String(env.PASSWORD || ""),
    passwordTemplate: String(env.PASSWORD_TEMPLATE || ""),
    userOffset: integerValue(env.USER_OFFSET, 0, { min: 0 }),
    projectId: String(env.PROJECT_ID || "").trim(),
    saveSettings,
    settingKey,
    settingValue: env.SETTING_VALUE === undefined ? undefined : jsonValue(env.SETTING_VALUE, "SETTING_VALUE"),
    pauseSeconds: numberValue(env.PAUSE_SECONDS, profile === "smoke" ? 0.2 : 1, { min: 0, max: 60 }),
    requestTimeoutMs: integerValue(env.REQUEST_TIMEOUT_MS, defaults.requestTimeoutMs, { min: 100, max: 120_000 }),
    p95Ms: numberValue(env.P95_MS, 500, { min: 1 }),
    p99Ms: numberValue(env.P99_MS, 1000, { min: 1 }),
    maxErrorRate: numberValue(env.MAX_ERROR_RATE, 0.01, { min: 0, max: 1 }),
    summaryPath: String(env.SUMMARY_PATH || "").trim(),
  };

  if (!config.username && !config.usernameTemplate) {
    throw new Error("USERNAME or USERNAME_TEMPLATE is required");
  }
  if (!config.password && !config.passwordTemplate) {
    throw new Error("PASSWORD or PASSWORD_TEMPLATE is required");
  }

  config.options = buildK6Options(profile, env, defaults, config);
  return config;
}

export function buildK6Options(profile, env, defaults, config) {
  const scenario = profile === "smoke"
    ? {
        executor: "shared-iterations",
        vus: integerValue(env.VUS, defaults.vus, { min: 1 }),
        iterations: integerValue(env.ITERATIONS, defaults.iterations, { min: 1 }),
        maxDuration: durationValue(env.MAX_DURATION, defaults.maxDuration, "MAX_DURATION"),
        gracefulStop: "5s",
        tags: { profile: "smoke" },
      }
    : {
        executor: "ramping-vus",
        startVUs: 0,
        stages: [
          { duration: durationValue(env.RAMP_UP, defaults.rampUp, "RAMP_UP"), target: integerValue(env.VUS, defaults.vus, { min: 1 }) },
          { duration: durationValue(env.DURATION, defaults.steady, "DURATION"), target: integerValue(env.VUS, defaults.vus, { min: 1 }) },
          { duration: durationValue(env.RAMP_DOWN, defaults.rampDown, "RAMP_DOWN"), target: 0 },
        ],
        gracefulRampDown: "10s",
        tags: { profile: "load" },
      };

  return {
    scenarios: { gernetix_api: scenario },
    thresholds: {
      http_req_failed: [`rate<${config.maxErrorRate}`],
      flow_failures: [`rate<${config.maxErrorRate}`],
      http_req_duration: [`p(95)<${config.p95Ms}`, `p(99)<${config.p99Ms}`],
      "http_req_duration{endpoint:login}": [`p(95)<${config.p95Ms}`, `p(99)<${config.p99Ms}`],
      "http_req_duration{endpoint:project_list}": [`p(95)<${config.p95Ms}`, `p(99)<${config.p99Ms}`],
      "http_req_duration{endpoint:project_detail}": [`p(95)<${config.p95Ms}`, `p(99)<${config.p99Ms}`],
    },
    tags: {
      suite: "gernetix-system-tests",
      scenario: "authenticated-project-flow",
      settings_save: String(config.saveSettings),
      target_scope: "isolated-local",
    },
    summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  };
}

export function credentialsForVu(config, vuNumber) {
  const index = config.userOffset + positiveInteger(vuNumber, "vuNumber");
  return {
    username: interpolate(config.usernameTemplate || config.username, index),
    password: interpolate(config.passwordTemplate || config.password, index),
  };
}

function interpolate(template, index) {
  return String(template).replaceAll("{vu}", String(index)).replaceAll("{index}", String(index));
}

function normalizedBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new Error("BASE_URL must be an absolute HTTP(S) URL");
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error("BASE_URL must use HTTP or HTTPS");
  if (url.username || url.password || url.search || url.hash) throw new Error("BASE_URL must not contain credentials, query parameters, or a fragment");
  if (!isLoopbackHost(url.hostname)) {
    throw new Error(`Refusing non-loopback BASE_URL: ${url.hostname}`);
  }
  if (url.port !== "14300") throw new Error("BASE_URL must use dedicated system-test port 14300");
  return url.toString().replace(/\/$/, "");
}

function isLoopbackHost(hostname) {
  const normalized = String(hostname).toLowerCase();
  return normalized === "localhost" || normalized === "[::1]" || normalized === "::1" || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

function booleanValue(value, fallback) {
  if (value === undefined || value === "") return fallback;
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  throw new Error(`Invalid boolean value: ${value}`);
}

function integerValue(value, fallback, limits = {}) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Expected an integer, got: ${value}`);
  if (limits.min !== undefined && parsed < limits.min) throw new Error(`Integer must be >= ${limits.min}`);
  if (limits.max !== undefined && parsed > limits.max) throw new Error(`Integer must be <= ${limits.max}`);
  return parsed;
}

function positiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function numberValue(value, fallback, limits = {}) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected a number, got: ${value}`);
  if (limits.min !== undefined && parsed < limits.min) throw new Error(`Number must be >= ${limits.min}`);
  if (limits.max !== undefined && parsed > limits.max) throw new Error(`Number must be <= ${limits.max}`);
  return parsed;
}

function durationValue(value, fallback, name) {
  const duration = String(value || fallback);
  if (!/^\d+(?:\.\d+)?(?:ms|s|m|h)$/.test(duration)) throw new Error(`${name} must be a k6 duration such as 30s or 5m`);
  return duration;
}

function enumValue(value, allowed, name) {
  if (!allowed.includes(value)) throw new Error(`${name} must be one of: ${allowed.join(", ")}`);
  return value;
}

function jsonValue(value, name) {
  try {
    return JSON.parse(String(value));
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
}
