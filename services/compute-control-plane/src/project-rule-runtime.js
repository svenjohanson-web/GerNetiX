"use strict";

const { ComputeError } = require("./errors");

function executeProjectRule(program, snapshot, grant = {}, options = {}) {
  const state = { nodes: 0, started: Date.now(), maxNodes: bounded(options.maxNodes, 500), maxDepth: bounded(options.maxDepth, 20), maxRuntimeMs: bounded(options.maxRuntimeMs, 50), reads: new Set(grant.read_paths || []), writes: new Set(grant.write_paths || []), snapshot: structuredClone(snapshot || {}), patch: {} };
  runStatements(program?.statements, state, 0);
  return { patch: state.patch, metrics: { evaluated_nodes: state.nodes, runtime_ms: Date.now() - state.started } };
}

function createProjectRuleHandler({ inputResolver, outputPublisher, options = {} }) {
  if (typeof inputResolver !== "function" || typeof outputPublisher !== "function") throw new TypeError("inputResolver und outputPublisher werden benötigt");
  return async function handleProjectRule(job) {
    if (job.execution_class !== "isolated_project_rule") throw Object.assign(new Error("Falsche Ausführungsklasse"), { code: "project_rule_execution_class_mismatch" });
    const input = await inputResolver({ input_revision: job.input_revision, tenant: job.tenant, job_id: job.job_id });
    const evaluation = executeProjectRule(input.program, input.snapshot, input.grant, options);
    return outputPublisher({ job_id: job.job_id, tenant: job.tenant, input_revision: job.input_revision, patch: evaluation.patch, metrics: evaluation.metrics });
  };
}

function runStatements(statements, state, depth) {
  if (!Array.isArray(statements)) throw invalid("statements muss eine Liste sein");
  for (const statement of statements) {
    tick(state, depth);
    if (statement.type === "set") {
      requirePath(statement.path, state.writes, "write_path_denied");
      setPath(state.patch, statement.path, evaluate(statement.value, state, depth + 1));
    } else if (statement.type === "if") {
      runStatements(evaluate(statement.condition, state, depth + 1) ? statement.then : (statement.else || []), state, depth + 1);
    } else throw invalid(`Statement-Typ ${String(statement.type)} ist nicht erlaubt`);
  }
}

function evaluate(node, state, depth) {
  tick(state, depth);
  if (!node || typeof node !== "object") throw invalid("Ausdruck fehlt");
  if (node.type === "literal") return primitive(node.value);
  if (node.type === "read") { requirePath(node.path, state.reads, "read_path_denied"); return getPath(state.snapshot, node.path); }
  if (node.type === "not") return !evaluate(node.value, state, depth + 1);
  if (node.type === "binary") return binary(node.op, evaluate(node.left, state, depth + 1), evaluate(node.right, state, depth + 1));
  if (node.type === "call") {
    const args = (node.args || []).map((value) => evaluate(value, state, depth + 1));
    if (node.name === "min") return Math.min(...args.map(finite));
    if (node.name === "max") return Math.max(...args.map(finite));
    if (node.name === "round" && args.length === 1) return Math.round(finite(args[0]));
    if (node.name === "clamp" && args.length === 3) return Math.min(finite(args[2]), Math.max(finite(args[1]), finite(args[0])));
    throw invalid(`Funktion ${String(node.name)} ist nicht erlaubt`);
  }
  throw invalid(`Ausdruckstyp ${String(node.type)} ist nicht erlaubt`);
}

function binary(op, left, right) {
  if (op === "eq") return left === right;
  if (op === "ne") return left !== right;
  if (op === "gt") return finite(left) > finite(right);
  if (op === "gte") return finite(left) >= finite(right);
  if (op === "lt") return finite(left) < finite(right);
  if (op === "lte") return finite(left) <= finite(right);
  if (op === "add") return finite(left) + finite(right);
  if (op === "sub") return finite(left) - finite(right);
  if (op === "mul") return finite(left) * finite(right);
  if (op === "div") { const divisor = finite(right); if (divisor === 0) throw invalid("Division durch null"); return finite(left) / divisor; }
  if (op === "and") return Boolean(left && right);
  if (op === "or") return Boolean(left || right);
  throw invalid(`Operator ${String(op)} ist nicht erlaubt`);
}

function tick(state, depth) { state.nodes += 1; if (state.nodes > state.maxNodes) throw limit("project_rule_node_limit"); if (depth > state.maxDepth) throw limit("project_rule_depth_limit"); if (Date.now() - state.started > state.maxRuntimeMs) throw limit("project_rule_runtime_limit"); }
function requirePath(path, allowed, code) { if (!allowed.has(String(path))) throw new ComputeError(code, `Projektregel darf ${String(path)} nicht verwenden.`, 403); }
function getPath(object, path) { return String(path).split(".").reduce((value, key) => value?.[key], object); }
function setPath(object, path, value) { const keys = String(path).split("."); let target = object; for (const key of keys.slice(0, -1)) target = target[key] ||= {}; target[keys.at(-1)] = primitive(value); }
function primitive(value) { if (!["string", "number", "boolean"].includes(typeof value) && value !== null) throw invalid("Nur primitive Werte sind erlaubt"); if (typeof value === "number" && !Number.isFinite(value)) throw invalid("Zahl ist nicht endlich"); return value; }
function finite(value) { if (typeof value !== "number" || !Number.isFinite(value)) throw invalid("Numerischer Wert erwartet"); return value; }
function bounded(value, fallback) { const number = Number(value || fallback); return Number.isInteger(number) && number > 0 ? number : fallback; }
function invalid(message) { return new ComputeError("invalid_project_rule", message, 422); }
function limit(code) { return new ComputeError(code, "Projektregel überschreitet ihr Ausführungslimit.", 422); }

module.exports = { createProjectRuleHandler, executeProjectRule };
