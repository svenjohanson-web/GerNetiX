const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const TOOL_DIR = __dirname;
const REPO_ROOT = path.resolve(TOOL_DIR, "..", "..");
const MODEL_ROOTS = ["data", "model"];
const DEFAULT_DB_PATH = path.join(TOOL_DIR, "out", "model-graph.sqlite");

const COMMON_ALLOWED_ARTIFACT_TYPES = new Map([
  ["vision", "Vision"],
  ["business_goal", "Business Goal"],
  ["business_capability", "Business Capability"],
  ["business_strategy", "Business Strategy / Course of Action"],
  ["strategy", "Strategy / Course of Action"],
  ["measure", "Measure"],
  ["business_rule", "Business Rule"],
  ["customer_journey", "Customer Journey"],
  ["requirement", "Requirement"],
  ["non_functional_requirement", "Non-Functional Requirement"],
  ["nfr", "Non-Functional Requirement"],
  ["product", "Product"],
  ["product_offering", "Product Offering"],
  ["course", "Course"],
  ["audience", "Audience"],
  ["value_proposition", "Value Proposition"],
  ["learning_goal", "Learning Goal"],
  ["competency", "Competency"],
  ["learning_path", "Learning Path"],
  ["learning_path_step", "Learning Path Step"],
  ["learning_project", "Learning Project"],
  ["project", "Learning Project"],
  ["learning_project_idea", "Learning Project Idea"],
  ["project_idea", "Project Idea"],
  ["learning_unit", "Learning Unit"],
  ["example_domain", "Example Domain"],
  ["technical_capability", "Technical Capability"],
  ["capability", "Technical Capability"],
  ["system_capability", "System Capability"],
  ["plan", "Plan"],
  ["role", "Role"],
  ["business_domain", "Business Domain"],
  ["architecture_artifact", "Architecture Artifact"],
  ["architecture_structural_element", "Architecture Structural Element"],
  ["architecture_decision", "Architecture Decision"],
  ["architecture_rule", "Architecture Rule"],
  ["data_model", "Data Model"],
  ["api_artifact", "API Artifact"],
  ["ui_model", "UI Model"],
  ["implementation_artifact", "Implementation Artifact"],
  ["test_artifact", "Test Artifact"],
  ["validation_artifact", "Validation Artifact"],
  ["domain_event", "Domain Event"],
  ["feature", "Feature"],
  ["risk", "Risk"],
  ["gap", "Gap"],
  ["open_question", "Open Question"],
  ["principle", "Principle"],
  ["validation_rule", "Validation Rule"],
  ["metamodel", "Metamodel"],
  ["metamodel_view", "Metamodel View"],
  ["metamodel_uml", "Metamodel UML"],
  ["metamodel_artifact", "Metamodel Artifact"],
  ["metamodel_part", "Metamodel Part"],
  ["knowledge_base", "Knowledge Base"],
  ["requirement_rule", "Requirement Rule"],
  ["todo", "Todo"],
  ["deprecated_sales_learning_offer", "Deprecated Sales Learning Offer"],
  ["technical_constraint", "Technical Constraint"],
  ["project_stage", "Project Stage"],
  ["software_module", "Software Module"],
  ["learning_target", "Learning Target"],
  ["architecture_topology", "Architecture Topology"],
  ["project_variant", "Project Variant"],
  ["architecture_component", "Architecture Component"]
]);

const COMMON_ARTIFACT_TYPE_DESCRIPTIONS = new Map([
  [
    "actuator",
    "Hardware-Entitaet fuer Komponenten mit kinetischen Eigenschaften, die physisch etwas bewegen, betaetigen, oeffnen, schliessen, schalten oder anderweitig auf die reale Umgebung einwirken."
  ]
]);

const COMMON_ALLOWED_RELATION_TYPES = [
  "supports",
  "realizes",
  "drives",
  "constrains",
  "is_view_of",
  "refines",
  "derives_from",
  "requires",
  "has",
  "has_child",
  "contains",
  "provides",
  "provided_by",
  "constrained_by",
  "derives",
  "affects",
  "realized_by",
  "verified_by",
  "validated_by",
  "belongs_to",
  "uses",
  "enables",
  "enabled_by",
  "grants",
  "depends_on",
  "optionally_uses",
  "blocks",
  "mitigates",
  "owns",
  "extends",
  "illustrates",
  "targets",
  "realized_in",
  "validates",
  "references",
  "decomposes",
  "used_by",
  "applies_to",
  "verifies",
  "justifies",
  "compares",
  "primary_users",
  "cost_impact",
  "optional_prerequisites",
  "learning_path_stable",
  "mitigated_by",
  "offline_variant",
  "online_ai_variant",
  "possible_learning_paths",
  "relates_to",
  "replaced_by",
  "todos"
];

const HIERARCHICAL_RELATION_TYPES = new Set([
  "contains",
  "has",
  "has_child",
  "derived_from",
  "decomposes"
]);

const FIELD_RELATION_OVERRIDES = new Map([
  ["supportsBusinessGoals", "supports"],
  ["supportsGoals", "supports"],
  ["supportsStrategies", "supports"],
  ["enabledByBusinessCapabilities", "enabled_by"],
  ["requiresBusinessCapabilities", "requires"],
  ["providesBusinessCapabilities", "provides"],
  ["realizesBusinessCapabilities", "realizes"],
  ["derivedFromBusinessCapabilities", "derives_from"],
  ["constrainedByBusinessRules", "constrained_by"],
  ["realizesSystemCapabilities", "realizes"],
  ["grantsSystemCapabilities", "grants"],
  ["realizesRequirements", "realizes"],
  ["derivedFromRequirements", "derives_from"],
  ["containsMeasures", "contains"],
  ["parentMeasures", "belongs_to"],
  ["containsCourses", "contains"],
  ["containsLearningGoals", "contains"],
  ["containsLearningPaths", "contains"],
  ["containsProjects", "contains"],
  ["targetLearningGoals", "targets"],
  ["primaryLearningGoal", "targets"],
  ["learningPath", "belongs_to"],
  ["belongsTo", "belongs_to"],
  ["metamodelRoot", "is_view_of"],
  ["relationToRoot", "references"],
  ["usesCapabilities", "uses"],
  ["requiredCapabilities", "requires"],
  ["optionalCapabilities", "optionally_uses"],
  ["affectedArtifacts", "affects"],
  ["affectedArchitectureArtifacts", "affects"],
  ["affectedDataModels", "affects"],
  ["affectedApis", "affects"],
  ["affectedUiModels", "affects"],
  ["verifiedBy", "verified_by"],
  ["validatedBy", "validated_by"],
  ["realizedBy", "realized_by"],
  ["dependsOn", "depends_on"],
  ["technicalConstraints", "requires"],
  ["dependencies", "depends_on"],
  ["providedByMeasures", "provided_by"],
  ["variants", "contains"],
  ["belongsToBusinessDomain", "belongs_to"],
  ["usedBy", "used_by"],
  ["optional", "optionally_uses"],
  ["valuePropositions", "uses"],
  ["derivesRequirements", "derives"],
  ["projects", "contains"],
  ["considersBusinessRules", "references"],
  ["appliesToMeasures", "applies_to"],
  ["targetAudiences", "targets"],
  ["appliesTo", "applies_to"],
  ["risks", "affects"],
  ["validatesRequirements", "validates"],
  ["verifiesRequirements", "verifies"],
  ["justifiesBusinessGoals", "justifies"],
  ["product", "belongs_to"],
  ["relatedDataModels", "affects"],
  ["secondaryLearningGoals", "targets"],
  ["constrainsBusinessCapabilities", "constrains"],
  ["constrainsSystemCapabilities", "constrains"],
  ["ownsFeatures", "owns"],
  ["realizedBySystemCapabilities", "realized_by"],
  ["verifiedByTestArtifacts", "verified_by"],
  ["customerJourneys", "supports"],
  ["ownsCapabilities", "owns"],
  ["realizedByFeatures", "realized_by"],
  ["learningGoals", "contains"],
  ["prerequisites", "requires"],
  ["belongsToBusinessGoals", "belongs_to"],
  ["belongsToBusinessStrategies", "belongs_to"],
  ["comparesVariants", "compares"],
  ["systemCapabilities", "uses"],
  ["principles", "references"],
  ["primaryUsers", "primary_users"],
  ["realizedByImplementationArtifacts", "realized_by"],
  ["validatedByValidationArtifacts", "validated_by"],
  ["belongsToOfferings", "belongs_to"],
  ["costImpact", "cost_impact"],
  ["optionalPrerequisites", "optional_prerequisites"],
  ["products", "contains"],
  ["course", "belongs_to"],
  ["learningPathStable", "learning_path_stable"],
  ["mitigatedBy", "mitigated_by"],
  ["offlineVariant", "offline_variant"],
  ["onlineAiVariant", "online_ai_variant"],
  ["possibleLearningPaths", "possible_learning_paths"],
  ["primaryLearningGoals", "targets"],
  ["relatedLearningPaths", "references"],
  ["relatesTo", "relates_to"],
  ["replacedBy", "replaced_by"],
  ["requiredSystemCapabilities", "requires"],
  ["todos", "todos"],
  ["makerLabTodos", "todos"]
]);

const IGNORED_REFERENCE_FIELDS = new Set([
  "id",
  "type",
  "title",
  "name",
  "summary",
  "description",
  "status",
  "businessStatus",
  "implementationStatus",
  "ownerDomain",
  "schemaVersion",
  "kind",
  "sourceOfTruth",
  "sourceStatus",
  "sourceFile",
  "sources",
  "source",
  "path",
  "file",
  "files",
  "line",
  "confidence",
  "category",
  "projectStatus",
  "relation",
  "from",
  "to",
  "target",
  "source",
  "range",
  "label"
]);

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
    rule("architecture_component", "constrained_by", "non_functional_requirement"),
    rule("architecture_decision", "affects", "architecture_artifact"),
    rule("architecture_decision", "affects", "architecture_component"),
    rule("architecture_decision", "affects", "system_capability"),
    rule("architecture_decision", "affects", "technical_capability"),
    rule("architecture_decision", "constrains", "knowledge_base"),
    rule("architecture_decision", "constrains", "metamodel"),
    rule("architecture_decision", "references", "architecture_decision"),
    rule("architecture_decision", "references", "non_functional_requirement"),
    rule("architecture_decision", "references", "principle"),
    rule("architecture_decision", "realizes", "knowledge_base"),
    rule("architecture_structural_element", "enables", "system_capability"),
    rule("architecture_structural_element", "realizes", "business_goal"),
    rule("architecture_structural_element", "supports", "business_goal"),
    rule("architecture_structural_element", "supports", "customer_journey"),
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
    rule("implementation_artifact", "realizes", "requirement"),
    rule("knowledge_base", "constrained_by", "architecture_decision"),
    rule("learning_goal", "realizes", "learning_path"),
    rule("learning_goal", "realized_by", "learning_path"),
    rule("learning_path", "realizes", "business_capability"),
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
    rule("gap", "affects", "architecture_decision"),
    rule("principle", "guides", "architecture_decision"),
    rule("product_offering", "constrained_by", "business_rule"),
    rule("product_offering", "constrained_by", "non_functional_requirement"),
    rule("product_offering", "realizes", "business_capability"),
    rule("product_offering", "references", "learning_path"),
    rule("product_offering", "supports", "business_goal"),
    rule("product", "realizes", "business_goal"),
    rule("project_stage", "affects", "risk"),
    rule("requirement", "affects", "architecture_component"),
    rule("requirement", "affects", "architecture_structural_element"),
    rule("requirement", "constrained_by", "non_functional_requirement"),
    rule("requirement", "affects", "test_artifact"),
    rule("requirement", "affects", "ui_model"),
    rule("requirement", "references", "business_rule"),
    rule("requirement", "supports", "customer_journey"),
    rule("risk", "affects", "architecture_component"),
    rule("risk", "affects", "architecture_structural_element"),
    rule("risk", "affects", "learning_path"),
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

function openDatabase(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE artifact_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      source TEXT NOT NULL,
      is_allowed INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE artifacts (
      id TEXT PRIMARY KEY,
      artifact_type_id TEXT NOT NULL,
      title TEXT,
      status TEXT,
      owner_domain TEXT,
      summary TEXT,
      source_file TEXT NOT NULL,
      source_line INTEGER NOT NULL,
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      is_valid INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (artifact_type_id) REFERENCES artifact_types(id)
    );

    CREATE TABLE artifact_occurrences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      artifact_id TEXT NOT NULL,
      source_file TEXT NOT NULL,
      source_line INTEGER NOT NULL
    );

    CREATE TABLE relationship_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_hierarchical INTEGER NOT NULL DEFAULT 0,
      allows_cycles INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      is_allowed INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE relationship_type_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      relationship_type_id TEXT NOT NULL,
      source_artifact_type_id TEXT NOT NULL,
      target_artifact_type_id TEXT NOT NULL,
      source TEXT NOT NULL,
      FOREIGN KEY (relationship_type_id) REFERENCES relationship_types(id)
    );

    CREATE TABLE relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_artifact_id TEXT NOT NULL,
      relationship_type_id TEXT NOT NULL,
      target_artifact_id TEXT NOT NULL,
      confidence TEXT,
      source_file TEXT NOT NULL,
      source_line INTEGER NOT NULL,
      source_field TEXT,
      origin TEXT NOT NULL,
      is_valid INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (relationship_type_id) REFERENCES relationship_types(id)
    );

    CREATE TABLE validation_errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      severity TEXT NOT NULL,
      code TEXT NOT NULL,
      message TEXT NOT NULL,
      source_file TEXT,
      source_line INTEGER,
      artifact_id TEXT,
      relationship_id INTEGER
    );

    CREATE INDEX idx_relationships_source ON relationships(source_artifact_id);
    CREATE INDEX idx_relationships_target ON relationships(target_artifact_id);
    CREATE INDEX idx_relationships_type ON relationships(relationship_type_id);
    CREATE INDEX idx_validation_errors_code ON validation_errors(code);
  `);
}

function insertValidationError(db, error) {
  db.prepare(`
    INSERT INTO validation_errors
      (severity, code, message, source_file, source_line, artifact_id, relationship_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    error.severity || "error",
    error.code,
    error.message,
    error.sourceFile || null,
    error.sourceLine || null,
    error.artifactId || null,
    error.relationshipId || null
  );
}

function importGraph(dbPath = DEFAULT_DB_PATH) {
  const files = readModelFiles();
  const { artifacts, occurrences } = extractArtifacts(files);
  const artifactIds = new Set(artifacts.map((artifact) => artifact.id));
  const allowedTypes = parseAllowedTypesFromMetamodel(files);
  const allowedRelations = parseAllowedRelationTypes(files);
  const typeRules = parseTypeRules(files);
  for (const rule of typeRules) allowedRelations.add(rule.relation);
  const explicitRelations = extractExplicitRelations(files);
  const embeddedRelations = extractEmbeddedRelations(artifacts, artifactIds);
  const relations = uniqueRelations([...explicitRelations, ...embeddedRelations]);
  const db = openDatabase(dbPath);

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

function openExistingDatabase(dbPath = DEFAULT_DB_PATH) {
  if (!fs.existsSync(dbPath)) {
    const summary = importGraph(dbPath);
    console.error(`SQLite graph was missing and has been imported: ${summary.dbPath}`);
  }
  return new DatabaseSync(dbPath);
}

function printRows(rows) {
  console.log(JSON.stringify(rows, null, 2));
}

function commandSummary(dbPath) {
  const db = openExistingDatabase(dbPath);
  printRows(db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM artifact_types) AS artifact_types,
      (SELECT COUNT(*) FROM artifacts) AS artifacts,
      (SELECT COUNT(*) FROM relationship_types) AS relationship_types,
      (SELECT COUNT(*) FROM relationships) AS relationships,
      (SELECT COUNT(*) FROM validation_errors WHERE severity = 'error') AS errors,
      (SELECT COUNT(*) FROM validation_errors WHERE severity = 'warning') AS warnings
  `).all());
  db.close();
}

function commandRelations(dbPath, direction, id) {
  const db = openExistingDatabase(dbPath);
  const sql = direction === "outgoing"
    ? `SELECT r.source_artifact_id AS source, r.relationship_type_id AS relation, r.target_artifact_id AS target, t.artifact_type_id AS target_type, t.title AS target_title, r.source_file, r.source_line, r.origin, r.confidence
       FROM relationships r LEFT JOIN artifacts t ON t.id = r.target_artifact_id
       WHERE r.source_artifact_id = ? ORDER BY r.relationship_type_id, r.target_artifact_id`
    : `SELECT r.source_artifact_id AS source, r.relationship_type_id AS relation, r.target_artifact_id AS target, s.artifact_type_id AS source_type, s.title AS source_title, r.source_file, r.source_line, r.origin, r.confidence
       FROM relationships r LEFT JOIN artifacts s ON s.id = r.source_artifact_id
       WHERE r.target_artifact_id = ? ORDER BY r.relationship_type_id, r.source_artifact_id`;
  printRows(db.prepare(sql).all(id));
  db.close();
}

function commandTrace(dbPath, id) {
  const db = openExistingDatabase(dbPath);
  const allowed = new Set([
    "belongs_to",
    "contains",
    "targets",
    "realized_by",
    "supports",
    "realizes",
    "requires",
    "derives_from",
    "uses",
    "provides",
    "enabled_by",
    "enables",
    "is_view_of",
    "refines"
  ]);
  const visions = new Set(db.prepare("SELECT id FROM artifacts WHERE artifact_type_id = 'vision'").all().map((row) => row.id));
  const rows = db.prepare(`
    SELECT source_artifact_id AS source, relationship_type_id AS relation, target_artifact_id AS target
    FROM relationships
    WHERE relationship_type_id IN (${Array.from(allowed).map(() => "?").join(",")})
  `).all(...allowed);
  const byNode = new Map();
  const edgeKeys = new Set();
  function add(node, edge) {
    const key = `${node}|${edge.next}|${edge.text}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    if (!byNode.has(node)) byNode.set(node, []);
    byNode.get(node).push(edge);
  }
  for (const row of rows) {
    add(row.source, { next: row.target, text: `-[${row.relation}]-> ${row.target}` });
    add(row.target, { next: row.source, text: `<-[${row.relation}]- ${row.source}` });
  }
  const queue = [{ node: id, path: id, depth: 0, seen: new Set([id]) }];
  const found = [];
  const foundPaths = new Set();
  const bestDepth = new Map([[id, 0]]);
  while (queue.length > 0 && found.length < 50) {
    const current = queue.shift();
    if (current.depth > 0 && visions.has(current.node)) {
      if (!foundPaths.has(current.path)) {
        foundPaths.add(current.path);
        found.push({ path: current.path, depth: current.depth });
      }
      continue;
    }
    if (current.depth >= 8) continue;
    const nextEdges = byNode.get(current.node) || [];
    for (const edge of nextEdges.slice(0, 120)) {
      if (current.seen.has(edge.next)) continue;
      const nextDepth = current.depth + 1;
      if ((bestDepth.get(edge.next) ?? Infinity) < nextDepth - 1) continue;
      bestDepth.set(edge.next, Math.min(bestDepth.get(edge.next) ?? Infinity, nextDepth));
      const nextSeen = new Set(current.seen);
      nextSeen.add(edge.next);
      queue.push({
        node: edge.next,
        path: `${current.path} ${edge.text}`,
        depth: nextDepth,
        seen: nextSeen
      });
    }
  }
  printRows(found.sort((a, b) => a.depth - b.depth));
  db.close();
}

function commandIsolated(dbPath) {
  const db = openExistingDatabase(dbPath);
  printRows(db.prepare(`
    SELECT a.id, a.artifact_type_id AS type, a.title, a.source_file, a.source_line
    FROM artifacts a
    WHERE NOT EXISTS (SELECT 1 FROM relationships r WHERE r.source_artifact_id = a.id)
      AND NOT EXISTS (SELECT 1 FROM relationships r WHERE r.target_artifact_id = a.id)
    ORDER BY a.artifact_type_id, a.id
  `).all());
  db.close();
}

function commandClusters(dbPath) {
  const db = openExistingDatabase(dbPath);
  const roots = db.prepare(`
    SELECT id, artifact_type_id AS type, title
    FROM artifacts
    WHERE artifact_type_id IN ('business_goal', 'business_strategy', 'business_capability', 'system_capability')
    ORDER BY artifact_type_id, id
  `).all();
  const stmt = db.prepare(`
    WITH RECURSIVE cluster(root_id, artifact_id, depth) AS (
      SELECT ?, ?, 0
      UNION
      SELECT cluster.root_id, r.source_artifact_id, cluster.depth + 1
      FROM cluster
      JOIN relationships r ON r.target_artifact_id = cluster.artifact_id
      WHERE cluster.depth < 6
      UNION
      SELECT cluster.root_id, r.target_artifact_id, cluster.depth + 1
      FROM cluster
      JOIN relationships r ON r.source_artifact_id = cluster.artifact_id
      WHERE cluster.depth < 6
    )
    SELECT COUNT(DISTINCT artifact_id) AS size FROM cluster
  `);
  printRows(roots.map((root) => ({ ...root, cluster_size: stmt.get(root.id, root.id).size })));
  db.close();
}

function commandErrors(dbPath) {
  const db = openExistingDatabase(dbPath);
  printRows(db.prepare(`
    SELECT severity, code, message, source_file, source_line, artifact_id, relationship_id
    FROM validation_errors
    ORDER BY CASE severity WHEN 'error' THEN 0 ELSE 1 END, code, source_file, source_line
  `).all());
  db.close();
}

function parseDbPath(args) {
  const index = args.indexOf("--db");
  if (index === -1) return DEFAULT_DB_PATH;
  return path.resolve(REPO_ROOT, args[index + 1]);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "import";
  const dbPath = parseDbPath(args);

  if (command === "import") {
    console.log(JSON.stringify(importGraph(dbPath), null, 2));
    return;
  }
  if (command === "summary") return commandSummary(dbPath);
  if (command === "outgoing") return commandRelations(dbPath, "outgoing", args[1]);
  if (command === "incoming") return commandRelations(dbPath, "incoming", args[1]);
  if (command === "trace") return commandTrace(dbPath, args[1]);
  if (command === "isolated") return commandIsolated(dbPath);
  if (command === "clusters") return commandClusters(dbPath);
  if (command === "errors") return commandErrors(dbPath);

  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}

main();
