function templateArchitecturePlantUml(template, title) {
  const architecture = template?.architecture;
  if (!architecture?.elements?.length) return "";
  const elements = renderElements(architecture.elements);
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

function renderElements(elements) {
  const elementIds = new Set(elements.map((element) => element.id));
  const childrenByParent = new Map();
  for (const element of elements) {
    if (!element.parentId || !elementIds.has(element.parentId)) continue;
    const children = childrenByParent.get(element.parentId) || [];
    children.push(element);
    childrenByParent.set(element.parentId, children);
  }
  return elements
    .filter((element) => !element.parentId || !elementIds.has(element.parentId))
    .flatMap((element) => renderElement(element, childrenByParent, 0));
}

function renderElement(element, childrenByParent, depth) {
  const children = childrenByParent.get(element.id) || [];
  const indent = "  ".repeat(depth);
  const notation = element.kind === "actor" ? "actor" : "rectangle";
  const stereotype = element.stereotype ? ` <<${plantUmlText(element.stereotype)}>>` : "";
  const declaration = `${indent}${notation} "${plantUmlText(element.label)}" as ${plantUmlId(element.id)}${stereotype}`;
  if (!children.length) return [declaration];
  return [
    `${declaration} {`,
    ...children.flatMap((child) => renderElement(child, childrenByParent, depth + 1)),
    `${indent}}`,
  ];
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
