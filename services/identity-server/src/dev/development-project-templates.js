const { DEVELOPMENT_PROJECT_TEMPLATE_MODELS } = require("./development-project-template-models");
const { templateArchitecturePlantUml } = require("./development-project-template-views");
const { mergeSelectedGamesHeader, selectedGamesHeader, templateFirmwareSources } = require("./development-project-template-sources");
const { firmwareSoftwareUnitProblems } = require("../../../shared/firmware-project-contract");

function developmentProjectTemplate(templateId) {
  return DEVELOPMENT_PROJECT_TEMPLATE_MODELS[String(templateId || "empty")]
    || DEVELOPMENT_PROJECT_TEMPLATE_MODELS.empty;
}

function developmentProjectTemplateCatalog() {
  return Object.values(DEVELOPMENT_PROJECT_TEMPLATE_MODELS).map((template) => ({
    id: template.id,
    title: template.title,
    default_title: template.defaultTitle ?? template.title,
    description: template.description,
    hint: template.hint,
    required_entitlements: template.requiredEntitlements || [],
    board_selection_required: Boolean(template.boardSelectionRequired),
    model_schema_version: template.schemaVersion,
    ...(template.baseTemplateId ? { base_template_id: template.baseTemplateId } : {}),
  }));
}

function developmentProjectTemplatePreviews() {
  return Object.values(DEVELOPMENT_PROJECT_TEMPLATE_MODELS)
    .filter((template) => template.id !== "empty")
    .map((template) => ({
      template_id: template.id,
      title: `${template.title} · Initiale Architektur`,
      summary: template.hint || template.description,
      type: "plantuml",
      source: templateArchitecturePlantUml(template, template.title),
      derived_from: "project_template_preview",
    }));
}

function templateBuildConfig(template) {
  return template?.realization?.buildConfig || template?.realization?.softwareUnits?.[0]?.buildConfig || null;
}

function templateHardwareProfileId(template) {
  return template?.realization?.hardwareProfileId || "architecture.discovery";
}

function templateHardwareConfiguration(template) {
  return template?.realization?.hardwareConfiguration
    ? structuredClone(template.realization.hardwareConfiguration)
    : null;
}

function templateSoftwareUnits(template) {
  return (template?.realization?.softwareUnits || []).map((unit) => ({
    software_unit_id: unit.software_unit_id,
    title: unit.title,
    software_kind: unit.software_kind,
    build_system: unit.build_system,
    source_root: unit.source_root,
    entrypoint: unit.entrypoint,
    device_id: "",
    hardware_profile_id: unit.hardwareProfileId,
    build_config: structuredClone(unit.buildConfig),
  }));
}

function assertDevelopmentProjectTemplateContract(template) {
  const units = templateSoftwareUnits(template);
  if (!units.length) return;
  if (template?.realization?.systemSourceId) return;
  const sourcePaths = templateFirmwareSources(template, template.title).map((source) => source.path);
  for (const unit of units) {
    const problems = firmwareSoftwareUnitProblems(unit, sourcePaths, { requireEntrypointSource: true });
    if (problems.length) {
      throw new Error(`Template ${template.id} verletzt den Firmware-Projektvertrag: ${problems.join("; ")}`);
    }
  }
}

Object.values(DEVELOPMENT_PROJECT_TEMPLATE_MODELS).forEach(assertDevelopmentProjectTemplateContract);

module.exports = {
  developmentProjectTemplate,
  developmentProjectTemplateCatalog,
  developmentProjectTemplatePreviews,
  templateArchitecturePlantUml,
  templateBuildConfig,
  templateFirmwareSources,
  templateHardwareConfiguration,
  templateHardwareProfileId,
  templateSoftwareUnits,
  assertDevelopmentProjectTemplateContract,
  mergeSelectedGamesHeader,
  selectedGamesHeader,
};
