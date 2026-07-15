const { DEVELOPMENT_PROJECT_TEMPLATE_MODELS } = require("./development-project-template-models");
const { templateArchitecturePlantUml } = require("./development-project-template-views");
const { selectedGamesHeader, templateFirmwareSources } = require("./development-project-template-sources");

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
    model_schema_version: template.schemaVersion,
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
  return template?.realization?.buildConfig || null;
}

function templateHardwareProfileId(template) {
  return template?.realization?.hardwareProfileId || "architecture.discovery";
}

module.exports = {
  developmentProjectTemplate,
  developmentProjectTemplateCatalog,
  developmentProjectTemplatePreviews,
  templateArchitecturePlantUml,
  templateBuildConfig,
  templateFirmwareSources,
  templateHardwareProfileId,
  selectedGamesHeader,
};
