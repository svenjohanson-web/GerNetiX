const fs = require("fs");
const path = require("path");
const { createSchema, insertValidationError, openDatabase } = require("./src/database");
const {
  COMMON_ALLOWED_ARTIFACT_TYPES,
  COMMON_ALLOWED_RELATION_TYPES,
  COMMON_ARTIFACT_TYPE_DESCRIPTIONS,
  FIELD_RELATION_OVERRIDES,
  HIERARCHICAL_RELATION_TYPES,
  IGNORED_REFERENCE_FIELDS
} = require("./src/metamodel-defaults");

const TOOL_DIR = __dirname;
const REPO_ROOT = path.resolve(TOOL_DIR, "..", "..");
const MODEL_ROOTS = ["data", "model"];
const DEFAULT_DB_PATH = path.join(TOOL_DIR, "out", "model-graph.sqlite");

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function unquote(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim().replace(/^['"]|['"]$/g, "");
}

function normalizeTypeName(value) {
  return unquote(value)
    .replace(/\/.*$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function normalizeRelationName(value) {
  return normalizeTypeName(value);
}

function getIndent(line) {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function parseScalarLine(line, key) {
  const match = line.match(new RegExp(`^\\s*${key}:\\s*(.*)$`));
  return match ? unquote(match[1]) : "";
}

function parseAnyScalarLine(line) {
  const match = line.match(/^\s*([A-Za-z0-9_.-]+):\s*(.*?)\s*$/);
  if (!match) return null;
  return { key: match[1], value: unquote(match[2]) };
}

function looksLikeId(value) {
  return /^[A-Za-z][A-Za-z0-9_-]*(?:[.:][A-Za-z0-9_-]+)+$/.test(value) ||
    /^(BG|BC|BR|CJ)-\d+$/i.test(value);
}

function walkYamlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkYamlFiles(fullPath));
    } else if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function readModelFiles() {
  return MODEL_ROOTS.flatMap((root) => walkYamlFiles(path.join(REPO_ROOT, root)))
    .sort()
    .map((fullPath) => ({
      fullPath,
      path: toPosix(path.relative(REPO_ROOT, fullPath)),
      content: fs.readFileSync(fullPath, "utf8")
    }));
}

function isGeneratedAggregateFile(file) {
  return file.path === "model/traceability.yaml" ||
    /^status:\s*generated_model\s*$/m.test(file.content);
}

function inferTypeFromId(id, fallback) {
  const prefix = id.split(/[.:]/)[0];
  if (prefix === "constraint" && /^(mandatory|optional)$/i.test(fallback || "")) return "technical_constraint";
  if (fallback) return normalizeTypeName(fallback);
  if (/^BG-\d+$/i.test(id)) return "business_goal";
  if (/^BC-\d+$/i.test(id)) return "business_capability";
  if (/^BR-\d+$/i.test(id)) return "business_rule";
  if (/^CJ-\d+$/i.test(id)) return "customer_journey";
  const mapped = {
    app: "architecture_structural_element",
    architecture: "architecture_decision",
    architecture_artifact: "architecture_artifact",
    api_artifact: "api_artifact",
    audience: "audience",
    business_domain: "business_domain",
    business_strategy: "business_strategy",
    capability: "capability",
    component: "architecture_component",
    course: "course",
    data_model: "data_model",
    event: "domain_event",
    feature: "feature",
    gap: "gap",
    implementation_artifact: "implementation_artifact",
    knowledge_base: "knowledge_base",
    learning_goal: "learning_goal",
    learning_path: "learning_path",
    learning_path_step: "learning_path_step",
    learning_unit: "learning_unit",
    measure: "measure",
    metamodel: "metamodel",
    metamodel_artifact: "metamodel_artifact",
    module: "software_module",
    nfr: "nfr",
    open_question: "open_question",
    plan: "plan",
    principle: "principle",
    product: "product",
    product_offering: "product_offering",
    project: "project",
    project_idea: "project_idea",
    requirement_model: "requirement_rule",
    requirement: "requirement",
    risk: "risk",
    role: "role",
    software_module: "software_module",
    stage: "project_stage",
    strategy: "strategy",
    system_capability: "system_capability",
    test_artifact: "test_artifact",
    topology: "architecture_topology",
    ui_model: "ui_model",
    validation_artifact: "validation_artifact",
    variant: "project_variant",
    value: "value_proposition",
    vision: "vision"
  };
  if (id.startsWith("home_automation_target.")) return "learning_target";
  if (/\.variant\./.test(id)) return "project_variant";
  return mapped[prefix] || "unknown";
}

function extractBlock(lines, startIndex, startIndent) {
  const block = [];
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
      if (i > startIndex) {
        const indent = getIndent(line);
        const startsSiblingId = indent <= startIndent && /^\s*-\s*id:\s*/.test(line);
        const startsTopLevelId = startIndent === 0 && indent === 0 && /^id:\s*/.test(line);
        const startsNextTopLevelSection = startIndent === 0 && indent === 0 && /^[A-Za-z][A-Za-z0-9_-]*:\s*/.test(line);
        if (startsSiblingId || startsTopLevelId || startsNextTopLevelSection) break;
      }
    block.push({ lineNumber: i + 1, text: line });
  }
  return block;
}

function parentKeyForLine(lines, index, indent) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (!/\S/.test(line)) continue;
    const currentIndent = getIndent(line);
    if (currentIndent >= indent) continue;
    const match = line.match(/^\s*([A-Za-z0-9_.-]+):\s*$/);
    if (match) return match[1];
  }
  return "";
}

function isEmbeddedReferenceDefinition(lines, index, indent) {
  if (indent === 0) return false;
  const parentKey = parentKeyForLine(lines, index, indent);
  return parentKey === "views" || parentKey === "exampleDomain";
}

function extractArtifacts(files) {
  const artifacts = [];
  const occurrences = [];
  for (const file of files) {
    if (isGeneratedAggregateFile(file)) continue;
    const lines = file.content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(/^(\s*)(?:-\s*)?id:\s*([A-Za-z0-9_.:-]+)\s*$/);
      if (!match) continue;
      const indent = getIndent(lines[i]);
      if (isEmbeddedReferenceDefinition(lines, i, indent)) continue;
      const block = extractBlock(lines, i, indent);
      const fields = {};
      for (const item of block) {
        const scalar = parseAnyScalarLine(item.text);
        if (scalar && scalar.value !== "") fields[scalar.key] = scalar.value;
      }
      const id = match[2];
      const explicitType = fields.type || fields.kind || "";
      const type = inferTypeFromId(id, explicitType);
      artifacts.push({
        id,
        type,
        title: fields.title || fields.name || id,
        status: fields.status || fields.businessStatus || fields.implementationStatus || "",
        ownerDomain: fields.ownerDomain || "",
        summary: fields.summary || fields.description || "",
        sourceFile: file.path,
        sourceLine: i + 1,
        fields,
        block
      });
      occurrences.push({ id, sourceFile: file.path, sourceLine: i + 1 });
    }
  }
  return { artifacts, occurrences };
}

function extractExplicitRelations(files) {
  const file = files.find((entry) => entry.path === "model/relations.yaml");
  if (!file) return [];
  const lines = file.content.split(/\r?\n/);
  const relations = [];
  for (let i = 0; i < lines.length; i += 1) {
    const fromMatch = lines[i].match(/^\s*-\s*from:\s*(.+?)\s*$/);
    if (!fromMatch) continue;
    const relation = {
      from: unquote(fromMatch[1]),
      relation: "",
      to: "",
      confidence: "",
      sourceFile: file.path,
      sourceLine: i + 1,
      sourceField: "model/relations.yaml",
      origin: "explicit"
    };
    for (let j = i + 1; j < Math.min(lines.length, i + 12); j += 1) {
      relation.relation ||= parseScalarLine(lines[j], "relation");
      relation.to ||= parseScalarLine(lines[j], "to");
      relation.confidence ||= parseScalarLine(lines[j], "confidence");
    }
    if (relation.from && relation.relation && relation.to) {
      relation.relation = normalizeRelationName(relation.relation);
      relations.push(relation);
    }
  }
  return relations;
}

function relationFromField(key) {
  if (FIELD_RELATION_OVERRIDES.has(key)) return FIELD_RELATION_OVERRIDES.get(key);
  const normalized = normalizeRelationName(key);
  if (normalized.startsWith("supports")) return "supports";
  if (normalized.startsWith("contains")) return "contains";
  if (normalized.startsWith("requires")) return "requires";
  if (normalized.startsWith("uses")) return "uses";
  if (normalized.startsWith("realizes")) return "realizes";
  if (normalized.startsWith("depends_on")) return "depends_on";
  if (normalized.startsWith("affects")) return "affects";
  if (normalized.startsWith("grants")) return "grants";
  if (normalized.startsWith("targets")) return "targets";
  if (normalized.startsWith("references")) return "references";
  if (normalized.startsWith("enables")) return "enables";
  if (normalized.startsWith("parent")) return "belongs_to";
  return normalized;
}

function collectListValues(block, startIndex, parentIndent) {
  const values = [];
  for (let i = startIndex + 1; i < block.length; i += 1) {
    const line = block[i].text;
    const indent = getIndent(line);
    if (indent <= parentIndent && /\S/.test(line)) break;
    const item = line.match(/^\s*-\s*([A-Za-z0-9_.:-]+)\s*$/);
    if (item) values.push({ value: item[1], lineNumber: block[i].lineNumber });
  }
  return values;
}

function extractEmbeddedRelations(artifacts, artifactIds) {
  const relations = [];
  for (const artifact of artifacts) {
    for (let i = 0; i < artifact.block.length; i += 1) {
      const item = artifact.block[i];
      const scalar = parseAnyScalarLine(item.text);
      if (!scalar || IGNORED_REFERENCE_FIELDS.has(scalar.key)) continue;
      const relation = relationFromField(scalar.key);
      if (scalar.value && looksLikeId(scalar.value) && artifactIds.has(scalar.value)) {
        relations.push({
          from: artifact.id,
          relation,
          to: scalar.value,
          confidence: "high",
          sourceFile: artifact.sourceFile,
          sourceLine: item.lineNumber,
          sourceField: scalar.key,
          origin: "embedded"
        });
      }
      if (scalar.value === "") {
        const listValues = collectListValues(artifact.block, i, getIndent(item.text));
        for (const listItem of listValues) {
          if (looksLikeId(listItem.value) && artifactIds.has(listItem.value)) {
            relations.push({
              from: artifact.id,
              relation,
              to: listItem.value,
              confidence: "high",
              sourceFile: artifact.sourceFile,
              sourceLine: listItem.lineNumber,
              sourceField: scalar.key,
              origin: "embedded"
            });
          }
        }
      }
    }
  }
  return relations;
}

function parseAllowedTypesFromMetamodel(files) {
  const allowed = new Map(COMMON_ALLOWED_ARTIFACT_TYPES);
  const uml = files.find((file) => file.path === "data/metamodel/learning-platform-uml.yaml");
  if (uml) {
    let currentType = "";
    for (const line of uml.content.split(/\r?\n/)) {
      const match = line.match(/^\s*-\s*name:\s*(.+?)\s*$/);
      if (match) {
        currentType = normalizeTypeName(match[1]);
        allowed.set(currentType, unquote(match[1]));
        continue;
      }
      const description = line.match(/^\s*description:\s*(.+?)\s*$/);
      if (description && currentType) {
        COMMON_ARTIFACT_TYPE_DESCRIPTIONS.set(currentType, unquote(description[1]));
      }
    }
  }
  const trace = files.find((file) => file.path === "data/business/business-traceability-metamodel.yaml");
  if (trace) {
    for (const line of trace.content.split(/\r?\n/)) {
      const match = line.match(/^\s*name:\s*(.+?)\s*$/);
      if (match) {
        const name = unquote(match[1]);
        if (/^[A-Z]/.test(name)) allowed.set(normalizeTypeName(name), name);
      }
    }
  }
  return allowed;
}

function parseAllowedRelationTypes(files) {
  const allowed = new Set(COMMON_ALLOWED_RELATION_TYPES);
  for (const file of files.filter((entry) => /metamodel|business-traceability/.test(entry.path))) {
    for (const line of file.content.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:-\s*)?relation:\s*(.+?)\s*$/);
      if (match) allowed.add(normalizeRelationName(match[1]));
    }
  }
  return allowed;
}

function parseTypeRules(files) {
  const rules = [];
  const uml = files.find((file) => file.path === "data/metamodel/learning-platform-uml.yaml");
  if (uml) {
    const lines = uml.content.split(/\r?\n/);
    let current = null;
    for (const line of lines) {
      const from = line.match(/^\s*-\s*from:\s*(.+?)\s*$/);
      if (from) {
        if (current && current.from && current.to && current.label) rules.push(current);
        current = { from: normalizeTypeName(from[1]), to: "", relation: "" };
        continue;
      }
      if (!current) continue;
      const to = line.match(/^\s*to:\s*(.+?)\s*$/);
      const label = line.match(/^\s*label:\s*(.+?)\s*$/);
      if (to) current.to = normalizeTypeName(to[1]);
      if (label) current.relation = normalizeRelationName(label[1]);
    }
    if (current && current.from && current.to && current.relation) rules.push(current);
  }
  const trace = files.find((file) => file.path === "data/business/business-traceability-metamodel.yaml");
  if (trace) {
    const lines = trace.content.split(/\r?\n/);
    let artifactType = "";
    let currentRelation = "";
    for (const line of lines) {
      const nameMatch = line.match(/^\s*name:\s*(.+?)\s*$/);
      if (nameMatch) artifactType = normalizeTypeName(nameMatch[1]);
      const rel = line.match(/^\s*-\s*relation:\s*(.+?)\s*$/);
      if (rel) {
        currentRelation = normalizeRelationName(rel[1]);
        continue;
      }
      const target = line.match(/^\s*target:\s*(.+?)\s*$/);
      if (target && artifactType && currentRelation) {
        rules.push({ from: artifactType, relation: currentRelation, to: normalizeTypeName(target[1]) });
      }
    }
  }
  return [...rules, ...supplementalTypeRules()];
}

function supplementalTypeRules() {
  return [
    rule("api_artifact", "affects", "data_model"),
    rule("architecture_artifact", "affects", "api_artifact"),
    rule("architecture_artifact", "affects", "data_model"),
    rule("architecture_artifact", "constrained_by", "non_functional_requirement"),
    rule("architecture_artifact", "open_decisions", "open_decision"),
    rule("architecture_component", "affects", "data_model"),
    rule("architecture_component", "constrained_by", "non_functional_requirement"),
    rule("architecture_component", "open_decisions", "open_decision"),
    rule("architecture_decision", "affects", "architecture_artifact"),
    rule("architecture_decision", "affects", "architecture_component"),
    rule("architecture_decision", "affects", "architecture_structural_element"),
    rule("architecture_decision", "affects", "system_capability"),
    rule("architecture_decision", "affects", "technical_capability"),
    rule("architecture_decision", "constrains", "knowledge_base"),
    rule("architecture_decision", "constrains", "metamodel"),
    rule("architecture_decision", "constrains", "requirement"),
    rule("architecture_decision", "realizes", "requirement"),
    rule("architecture_decision", "references", "architecture_decision"),
    rule("architecture_decision", "references", "requirement"),
    rule("architecture_decision", "references", "non_functional_requirement"),
    rule("architecture_decision", "references", "principle"),
    rule("architecture_decision", "realizes", "knowledge_base"),
    rule("architecture_decision", "supports", "business_goal"),
    rule("architecture_structural_element", "enables", "system_capability"),
    rule("architecture_structural_element", "realizes", "business_goal"),
    rule("architecture_structural_element", "supports", "business_goal"),
    rule("architecture_structural_element", "supports", "customer_journey"),
    rule("architecture_structural_element", "supports", "architecture_structural_element"),
    rule("architecture_artifact", "realizes", "architecture_decision"),
    rule("architecture_artifact", "references", "architecture_artifact"),
    rule("business_capability", "affects", "architecture_artifact"),
    rule("business_capability", "affects", "architecture_structural_element"),
    rule("business_capability", "constrained_by", "business_rule"),
    rule("business_capability", "constrained_by", "non_functional_requirement"),
    rule("business_capability", "enables", "business_strategy"),
    rule("business_capability", "realized_by", "feature"),
    rule("business_capability", "realizes", "product_offering"),
    rule("business_capability", "realized_by", "product_offering"),
    rule("business_capability", "realized_by", "system_capability"),
    rule("business_capability", "supports", "business_goal"),
    rule("business_rule", "constrains", "business_capability"),
    rule("business_rule", "constrains", "product_offering"),
    rule("business_rule", "constrains", "system_capability"),
    rule("business_rule", "supports", "business_goal"),
    rule("business_rule", "supports", "business_strategy"),
    rule("business_strategy", "has", "business_strategy"),
    rule("business_strategy", "has", "strategy"),
    rule("course", "realized_by", "learning_unit"),
    rule("course", "realizes", "business_capability"),
    rule("course", "supports", "business_goal"),
    rule("customer_journey", "supports", "business_goal"),
    rule("domain_event", "affects", "data_model"),
    rule("feature", "realizes", "business_capability"),
    rule("data_model", "realizes", "requirement"),
    rule("implementation_artifact", "realizes", "requirement"),
    rule("knowledge_base", "constrained_by", "architecture_decision"),
    rule("learning_goal", "realizes", "learning_path"),
    rule("learning_goal", "realized_by", "learning_path"),
    rule("learning_path", "realizes", "business_capability"),
    rule("learning_project", "open_decisions", "open_decision"),
    rule("learning_unit", "supports", "business_goal"),
    rule("learning_unit", "supports", "customer_journey"),
    rule("measure", "realizes", "requirement"),
    rule("measure", "supports", "business_goal"),
    rule("measure", "supports", "business_strategy"),
    rule("non_functional_requirement", "constrains", "system_capability"),
    rule("non_functional_requirement", "constrains", "architecture_structural_element"),
    rule("non_functional_requirement", "supports", "business_capability"),
    rule("non_functional_requirement", "supports", "business_goal"),
    rule("non_functional_requirement", "supports", "business_rule"),
    rule("non_functional_requirement", "supports", "business_strategy"),
    rule("non_functional_requirement", "supports", "customer_journey"),
    rule("deprecated_sales_learning_offer", "realized_by", "learning_unit"),
    rule("deprecated_sales_learning_offer", "supports", "business_goal"),
    rule("open_question", "affects", "architecture_decision"),
    rule("open_question", "affects", "metamodel"),
    rule("open_decision", "affects", "architecture_artifact"),
    rule("open_decision", "affects", "architecture_component"),
    rule("gap", "affects", "architecture_decision"),
    rule("principle", "guides", "architecture_decision"),
    rule("product_offering", "constrained_by", "business_rule"),
    rule("product_offering", "constrained_by", "non_functional_requirement"),
    rule("product_offering", "realizes", "business_capability"),
    rule("product_offering", "references", "learning_path"),
    rule("product_offering", "supports", "business_goal"),
    rule("product", "realizes", "business_goal"),
    rule("project_stage", "affects", "risk"),
    rule("project_stage", "open_decisions", "open_decision"),
    rule("plan", "references", "architecture_artifact"),
    rule("requirement", "affects", "architecture_component"),
    rule("requirement", "affects", "architecture_structural_element"),
    rule("requirement", "affects", "technical_capability"),
    rule("requirement", "constrained_by", "non_functional_requirement"),
    rule("requirement", "constrains", "project_variant"),
    rule("requirement", "affects", "test_artifact"),
    rule("requirement", "affects", "ui_model"),
    rule("requirement", "realized_by", "api_artifact"),
    rule("requirement", "realized_by", "architecture_artifact"),
    rule("requirement", "realized_by", "architecture_decision"),
    rule("requirement", "references", "business_rule"),
    rule("requirement", "references", "requirement"),
    rule("requirement", "supports", "business_goal"),
    rule("requirement", "supports", "customer_journey"),
    rule("requirement", "supports", "requirement"),
    rule("risk", "affects", "architecture_component"),
    rule("risk", "affects", "architecture_structural_element"),
    rule("risk", "affects", "learning_path"),
    rule("risk", "open_decisions", "open_decision"),
    rule("system_capability", "constrained_by", "business_rule"),
    rule("system_capability", "supports", "business_capability"),
    rule("technical_capability", "enables", "architecture_component"),
    rule("todo", "affects", "learning_path"),
    rule("todo", "affects", "product_offering"),
    rule("validation_rule", "constrains", "course"),
    rule("validation_rule", "constrains", "metamodel"),
    rule("validation_rule", "constrains", "product_offering"),
    rule("vision", "references", "principle"),
    rule("vision", "supports", "product"),
  ];
}

function rule(from, relation, to) {
  return { from, relation, to };
}

function uniqueRelations(relations) {
  const seen = new Set();
  const result = [];
  for (const relation of relations) {
    const key = `${relation.from}|${relation.relation}|${relation.to}|${relation.sourceFile}|${relation.sourceLine}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(relation);
  }
  return result;
}

function importGraph(dbPath = DEFAULT_DB_PATH) {
  const files = readModelFiles();
  const extracted = extractArtifacts(files);
  const db = openDatabase(dbPath);
  const authoredArtifacts = readAuthoredArtifacts(db);
  const artifacts = [...extracted.artifacts, ...authoredArtifacts];
  const occurrences = [
    ...extracted.occurrences,
    ...authoredArtifacts.map((artifact) => ({
      id: artifact.id,
      sourceFile: artifact.sourceFile,
      sourceLine: artifact.sourceLine
    }))
  ];
  const artifactIds = new Set(artifacts.map((artifact) => artifact.id));
  const allowedTypes = parseAllowedTypesFromMetamodel(files);
  const allowedRelations = parseAllowedRelationTypes(files);
  const typeRules = parseTypeRules(files);
  for (const rule of typeRules) allowedRelations.add(rule.relation);
  const explicitRelations = extractExplicitRelations(files);
  const embeddedRelations = extractEmbeddedRelations(artifacts, artifactIds);
  const authoredRelations = readAuthoredRelationships(db);
  const relations = uniqueRelations([...explicitRelations, ...embeddedRelations, ...authoredRelations]);

  createSchema(db);
  const observedTypes = new Set(artifacts.map((artifact) => artifact.type));
  for (const [id, name] of allowedTypes.entries()) {
    db.prepare("INSERT OR REPLACE INTO artifact_types (id, name, description, source, is_allowed) VALUES (?, ?, ?, ?, 1)")
      .run(id, name, COMMON_ARTIFACT_TYPE_DESCRIPTIONS.get(id) || "", "metamodel");
  }
  for (const type of observedTypes) {
    if (!allowedTypes.has(type)) {
      db.prepare("INSERT OR REPLACE INTO artifact_types (id, name, description, source, is_allowed) VALUES (?, ?, ?, ?, 0)")
        .run(type, type, "", "observed");
    }
  }

  for (const relation of allowedRelations) {
    db.prepare(`
      INSERT OR REPLACE INTO relationship_types
        (id, name, is_hierarchical, allows_cycles, source, is_allowed)
      VALUES (?, ?, ?, 0, ?, 1)
    `).run(relation, relation, HIERARCHICAL_RELATION_TYPES.has(relation) ? 1 : 0, "metamodel");
  }
  const observedRelationTypes = new Set(relations.map((relation) => relation.relation));
  for (const relation of observedRelationTypes) {
    if (!allowedRelations.has(relation)) {
      db.prepare(`
        INSERT OR REPLACE INTO relationship_types
          (id, name, is_hierarchical, allows_cycles, source, is_allowed)
        VALUES (?, ?, ?, 0, ?, 0)
      `).run(relation, relation, HIERARCHICAL_RELATION_TYPES.has(relation) ? 1 : 0, "observed");
    }
  }
  for (const rule of typeRules) {
    db.prepare(`
      INSERT INTO relationship_type_rules
        (relationship_type_id, source_artifact_type_id, target_artifact_type_id, source)
      VALUES (?, ?, ?, ?)
    `).run(rule.relation, rule.from, rule.to, "metamodel");
  }

  const grouped = new Map();
  for (const artifact of artifacts) {
    if (!grouped.has(artifact.id)) grouped.set(artifact.id, []);
    grouped.get(artifact.id).push(artifact);
  }

  for (const occurrence of occurrences) {
    db.prepare("INSERT INTO artifact_occurrences (artifact_id, source_file, source_line) VALUES (?, ?, ?)")
      .run(occurrence.id, occurrence.sourceFile, occurrence.sourceLine);
  }

  for (const [id, items] of grouped.entries()) {
    const artifact = items[0];
    const isDuplicate = items.length > 1 ? 1 : 0;
    const isAllowedType = allowedTypes.has(artifact.type);
    db.prepare(`
      INSERT INTO artifacts
        (id, artifact_type_id, title, status, owner_domain, summary, source_file, source_line, is_duplicate, is_valid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      artifact.id,
      artifact.type,
      artifact.title,
      artifact.status,
      artifact.ownerDomain,
      artifact.summary,
      artifact.sourceFile,
      artifact.sourceLine,
      isDuplicate,
      isAllowedType ? 1 : 0
    );
    if (isDuplicate) {
      insertValidationError(db, {
        severity: "error",
        code: "duplicate_artifact_id",
        message: `Artifact ID '${id}' occurs ${items.length} times.`,
        artifactId: id,
        sourceFile: artifact.sourceFile,
        sourceLine: artifact.sourceLine
      });
    }
    if (!isAllowedType) {
      insertValidationError(db, {
        severity: "error",
        code: "unknown_artifact_type",
        message: `Artifact '${id}' uses unknown artifact type '${artifact.type}'.`,
        artifactId: id,
        sourceFile: artifact.sourceFile,
        sourceLine: artifact.sourceLine
      });
    }
  }

  const insertRelationship = db.prepare(`
    INSERT INTO relationships
      (source_artifact_id, relationship_type_id, target_artifact_id, confidence, source_file, source_line, source_field, origin, is_valid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const relationRows = [];
  for (const relation of relations) {
    const sourceExists = artifactIds.has(relation.from);
    const targetExists = artifactIds.has(relation.to);
    const typeKnown = allowedRelations.has(relation.relation);
    const isValid = sourceExists && targetExists && typeKnown ? 1 : 0;
    const result = insertRelationship.run(
      relation.from,
      relation.relation,
      relation.to,
      relation.confidence || "",
      relation.sourceFile,
      relation.sourceLine,
      relation.sourceField || "",
      relation.origin,
      isValid
    );
    relationRows.push({ ...relation, id: Number(result.lastInsertRowid) });
    if (!sourceExists) {
      insertValidationError(db, {
        severity: "error",
        code: "missing_source_artifact",
        message: `Relationship source '${relation.from}' does not exist as artifact.`,
        sourceFile: relation.sourceFile,
        sourceLine: relation.sourceLine,
        relationshipId: Number(result.lastInsertRowid)
      });
    }
    if (!targetExists) {
      insertValidationError(db, {
        severity: "error",
        code: "missing_target_artifact",
        message: `Relationship target '${relation.to}' does not exist as artifact.`,
        sourceFile: relation.sourceFile,
        sourceLine: relation.sourceLine,
        relationshipId: Number(result.lastInsertRowid)
      });
    }
    if (!typeKnown) {
      insertValidationError(db, {
        severity: "error",
        code: "unknown_relationship_type",
        message: `Relationship '${relation.relation}' is not defined by the metamodel allow-list.`,
        sourceFile: relation.sourceFile,
        sourceLine: relation.sourceLine,
        relationshipId: Number(result.lastInsertRowid)
      });
    }
  }

  validateRelationshipTypeRules(db);
  validateHierarchyCycles(db);

  const summary = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM artifacts) AS artifact_count,
      (SELECT COUNT(*) FROM relationships) AS relationship_count,
      (SELECT COUNT(*) FROM validation_errors WHERE severity = 'error') AS error_count,
      (SELECT COUNT(*) FROM validation_errors WHERE severity = 'warning') AS warning_count
  `).get();
  db.close();
  return { dbPath, ...summary };
}

function readAuthoredArtifacts(db) {
  if (!tableExists(db, "graph_authored_artifacts")) return [];
  return db.prepare(`
    SELECT id, artifact_type_id, title, status, owner_domain, summary, properties_json
    FROM graph_authored_artifacts
    ORDER BY id
  `).all().map((row) => {
    const fields = safeJson(row.properties_json);
    return {
      id: row.id,
      type: row.artifact_type_id,
      title: row.title || row.id,
      status: row.status || "",
      ownerDomain: row.owner_domain || "",
      summary: row.summary || "",
      sourceFile: "sqlite://graph_authored_artifacts",
      sourceLine: 0,
      fields,
      block: authoredBlock(row.id, fields)
    };
  });
}

function readAuthoredRelationships(db) {
  if (!tableExists(db, "graph_authored_relationships")) return [];
  return db.prepare(`
    SELECT source_artifact_id, relationship_type_id, target_artifact_id, confidence, source_field
    FROM graph_authored_relationships
    ORDER BY source_artifact_id, relationship_type_id, target_artifact_id
  `).all().map((row) => ({
    from: row.source_artifact_id,
    relation: row.relationship_type_id,
    to: row.target_artifact_id,
    confidence: row.confidence || "high",
    sourceFile: "sqlite://graph_authored_relationships",
    sourceLine: 0,
    sourceField: row.source_field || "graph_authoring",
    origin: "graph_authoring"
  }));
}

function tableExists(db, tableName) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
}

function safeJson(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function authoredBlock(id, fields) {
  const block = [{ lineNumber: 0, text: `id: ${id}` }];
  for (const [key, value] of Object.entries(fields || {})) {
    if (Array.isArray(value)) {
      block.push({ lineNumber: 0, text: `${key}:` });
      for (const item of value) block.push({ lineNumber: 0, text: `  - ${item}` });
    } else if (value !== null && value !== undefined && typeof value !== "object") {
      block.push({ lineNumber: 0, text: `${key}: ${value}` });
    }
  }
  return block;
}

function validateRelationshipTypeRules(db) {
  const rulesByRelation = new Map();
  for (const row of db.prepare("SELECT * FROM relationship_type_rules").all()) {
    if (!rulesByRelation.has(row.relationship_type_id)) rulesByRelation.set(row.relationship_type_id, []);
    rulesByRelation.get(row.relationship_type_id).push(row);
  }
  const rows = db.prepare(`
    SELECT
      r.id,
      r.relationship_type_id,
      r.source_file,
      r.source_line,
      s.artifact_type_id AS source_type,
      t.artifact_type_id AS target_type,
      r.source_artifact_id,
      r.target_artifact_id
    FROM relationships r
    LEFT JOIN artifacts s ON s.id = r.source_artifact_id
    LEFT JOIN artifacts t ON t.id = r.target_artifact_id
    WHERE s.id IS NOT NULL AND t.id IS NOT NULL
  `).all();
  for (const row of rows) {
    const rules = rulesByRelation.get(row.relationship_type_id) || [];
    if (rules.length === 0) continue;
    const allowed = rules.some((rule) =>
      rule.source_artifact_type_id === row.source_type &&
      rule.target_artifact_type_id === row.target_type
    );
    if (!allowed) {
      insertValidationError(db, {
        severity: "warning",
        code: "invalid_source_target_type",
        message: `Relationship '${row.relationship_type_id}' from '${row.source_artifact_id}' (${row.source_type}) to '${row.target_artifact_id}' (${row.target_type}) does not match a metamodel type rule.`,
        sourceFile: row.source_file,
        sourceLine: row.source_line,
        relationshipId: row.id
      });
      db.prepare("UPDATE relationships SET is_valid = 0 WHERE id = ?").run(row.id);
    }
  }
}

function validateHierarchyCycles(db) {
  const edges = db.prepare(`
    SELECT r.id, r.source_artifact_id AS source, r.target_artifact_id AS target, r.relationship_type_id AS relation
    FROM relationships r
    JOIN relationship_types rt ON rt.id = r.relationship_type_id
    WHERE rt.is_hierarchical = 1
      AND r.source_artifact_id IN (SELECT id FROM artifacts)
      AND r.target_artifact_id IN (SELECT id FROM artifacts)
  `).all();
  const bySource = new Map();
  for (const edge of edges) {
    if (!bySource.has(edge.source)) bySource.set(edge.source, []);
    bySource.get(edge.source).push(edge);
  }
  const reported = new Set();
  function visit(node, stack, seen) {
    const nextEdges = bySource.get(node) || [];
    for (const edge of nextEdges) {
      const index = stack.indexOf(edge.target);
      if (index !== -1) {
        const cycle = [...stack.slice(index), edge.target].join(" -> ");
        if (!reported.has(cycle)) {
          reported.add(cycle);
          insertValidationError(db, {
            severity: "error",
            code: "hierarchy_cycle",
            message: `Cycle detected in hierarchical relationships: ${cycle}.`,
            relationshipId: edge.id
          });
        }
        continue;
      }
      if (seen.has(edge.target)) continue;
      seen.add(edge.target);
      visit(edge.target, [...stack, edge.target], seen);
    }
  }
  for (const source of bySource.keys()) visit(source, [source], new Set([source]));
}

module.exports = {
  DEFAULT_DB_PATH,
  importGraph
};

if (require.main === module) {
  const { runCli } = require("./src/cli-commands");
  runCli({
    args: process.argv.slice(2),
    defaultDbPath: DEFAULT_DB_PATH,
    repoRoot: REPO_ROOT,
    importGraph
  });
}
