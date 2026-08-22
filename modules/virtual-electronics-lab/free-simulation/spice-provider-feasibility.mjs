export const SPICE_PROVIDER_POLICY_VERSION = "1.0.0";

export const SPICE_PROVIDER_POLICY = Object.freeze({
  status: "feasible-with-gate-not-adopted",
  preferredArchitecture: "pinned-ngspice-emscripten-in-dedicated-web-worker",
  rawSpiceAccepted: false,
  generatedNetlistOnly: true,
  networkAccess: false,
  persistentFileSystem: false,
  sharedMemory: false,
  limits: Object.freeze({
    maxComponents: 32,
    maxNodes: 64,
    maxNetlistBytes: 16_384,
    maxOutputValues: 64_000,
    maxRuntimeMs: 2_000,
    maxMemoryBytes: 64 * 1024 * 1024,
  }),
  mandatoryGates: Object.freeze([
    "pinned-upstream-ngspice-release",
    "reproducible-self-build",
    "license-and-attribution-review",
    "worker-termination-timeout",
    "fixed-wasm-memory",
    "allowlisted-circuitdocument-translation",
    "no-command-console",
    "no-user-netlist",
    "cross-browser-resource-tests",
  ]),
  rejectedPrototypeTraits: Object.freeze([
    "third-party-latest-cdn",
    "export-all-c-api",
    "memory-growth",
    "main-thread-execution",
    "raw-command-interface",
  ]),
});

export function assessSpiceProvider(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "ELAB_SPICE_PROVIDER_REQUIRED", message: "Providerbeschreibung fehlt." }]) });
  }
  const required = {
    pinnedUpstreamRelease: true,
    reproducibleSelfBuild: true,
    licenseReviewed: true,
    dedicatedWorker: true,
    terminateOnTimeout: true,
    fixedMemory: true,
    generatedNetlistOnly: true,
    rawCommandInterface: false,
    networkAccess: false,
    persistentFileSystem: false,
  };
  const failures = Object.entries(required)
    .filter(([key, expected]) => candidate[key] !== expected)
    .map(([key]) => Object.freeze({ code: "ELAB_SPICE_PROVIDER_GATE_FAILED", message: `Provider-Gate nicht erfüllt: ${key}.`, gate: key }));
  if (!Number.isFinite(candidate.maxMemoryBytes) || candidate.maxMemoryBytes > SPICE_PROVIDER_POLICY.limits.maxMemoryBytes) {
    failures.push(Object.freeze({ code: "ELAB_SPICE_PROVIDER_MEMORY_LIMIT", message: "Provider überschreitet das feste Speicherlimit.", gate: "maxMemoryBytes" }));
  }
  if (!Number.isFinite(candidate.maxRuntimeMs) || candidate.maxRuntimeMs > SPICE_PROVIDER_POLICY.limits.maxRuntimeMs) {
    failures.push(Object.freeze({ code: "ELAB_SPICE_PROVIDER_RUNTIME_LIMIT", message: "Provider überschreitet das Laufzeitlimit.", gate: "maxRuntimeMs" }));
  }
  return failures.length
    ? Object.freeze({ ok: false, eligible: false, errors: Object.freeze(failures) })
    : Object.freeze({ ok: true, eligible: true, policyVersion: SPICE_PROVIDER_POLICY_VERSION });
}

