function templateArchitecturePlantUml(template, title) {
  const architecture = template?.architecture;
  if (!architecture?.elements?.length) return "";
  const elements = architecture.elements.map(renderElement);
  const relations = (architecture.relations || []).map(renderRelation);
  return [
    "@startuml",
    `title Architektur-Skizze: ${plantUmlText(title || template.title)}`,
    "",
    ...elements,
    ...(relations.length ? ["", ...relations] : []),
    "@enduml",
  ].join("\n");
}

function renderElement(element) {
  const notation = element.kind === "actor" ? "actor" : "rectangle";
  return `${notation} "${plantUmlText(element.label)}" as ${plantUmlId(element.id)}`;
}

function renderRelation(relation) {
  const label = relation.label ? ` : ${plantUmlText(relation.label)}` : "";
  return `${plantUmlId(relation.source)} --> ${plantUmlId(relation.target)}${label}`;
}

function plantUmlId(value) {
  const id = String(value || "element").replace(/[^A-Za-z0-9_]/g, "_");
  return /^[A-Za-z_]/.test(id) ? id : `element_${id}`;
}

function plantUmlText(value) {
  return String(value || "")
    .replace(/\r?\n/g, "\\n")
    .replace(/"/g, "'")
    .replace(/@(?:start|end)uml/gi, "");
}

module.exports = { templateArchitecturePlantUml };
