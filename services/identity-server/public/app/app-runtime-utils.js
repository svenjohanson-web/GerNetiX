// GerNetiX platform module extracted from app.js.
async function createPlantUmlSvgUrl(source) {
  const bytes = new TextEncoder().encode(themedPlantUmlSource(source));
  const compressed = await deflateForPlantUml(bytes);
  return `https://www.plantuml.com/plantuml/svg/${encodePlantUmlBytes(compressed)}`;
}

function themedPlantUmlSource(source) {
  const theme = [
    "skinparam backgroundColor transparent",
    "skinparam shadowing false",
    "skinparam defaultFontColor #F8FAFC",
    "skinparam defaultFontSize 15",
    "skinparam stereotypeFontColor #E2E8F0",
    "skinparam TitleFontColor #F8FAFC",
    "skinparam TitleFontSize 18",
    "skinparam ArrowColor #F8FAFC",
    "skinparam ArrowFontColor #F8FAFC",
    "skinparam ArrowThickness 2",
    "skinparam rectangleBackgroundColor #1E3A5F",
    "skinparam rectangleBorderColor #67E8F9",
    "skinparam rectangleFontColor #FFFFFF",
    "skinparam actorBackgroundColor #1E3A5F",
    "skinparam actorBorderColor #67E8F9",
    "skinparam actorFontColor #FFFFFF",
    "skinparam componentBackgroundColor #1E3A5F",
    "skinparam componentBorderColor #67E8F9",
    "skinparam componentFontColor #FFFFFF",
    "skinparam nodeBackgroundColor #1E3A5F",
    "skinparam nodeBorderColor #67E8F9",
    "skinparam nodeFontColor #FFFFFF",
    "skinparam databaseBackgroundColor #1E3A5F",
    "skinparam databaseBorderColor #67E8F9",
    "skinparam databaseFontColor #FFFFFF",
    "skinparam packageBackgroundColor #172554",
    "skinparam packageBorderColor #67E8F9",
    "skinparam packageFontColor #FFFFFF",
    "skinparam classBackgroundColor #1E3A5F",
    "skinparam classBorderColor #67E8F9",
    "skinparam classFontColor #FFFFFF",
    "skinparam noteBackgroundColor #334155",
    "skinparam noteBorderColor #FACC15",
    "skinparam noteFontColor #FFFFFF",
    "skinparam participantBackgroundColor #1E3A5F",
    "skinparam participantBorderColor #67E8F9",
    "skinparam participantFontColor #FFFFFF",
    "skinparam sequenceLifeLineBorderColor #E2E8F0",
    "skinparam sequenceDividerBackgroundColor #334155",
    "skinparam sequenceDividerBorderColor #67E8F9",
    "skinparam sequenceDividerFontColor #FFFFFF",
    "skinparam activityBackgroundColor #1E3A5F",
    "skinparam activityBorderColor #67E8F9",
    "skinparam activityFontColor #FFFFFF",
    "skinparam stateBackgroundColor #1E3A5F",
    "skinparam stateBorderColor #67E8F9",
    "skinparam stateFontColor #FFFFFF",
    "skinparam usecaseBackgroundColor #1E3A5F",
    "skinparam usecaseBorderColor #67E8F9",
    "skinparam usecaseFontColor #FFFFFF",
    "skinparam objectBackgroundColor #1E3A5F",
    "skinparam objectBorderColor #67E8F9",
    "skinparam objectFontColor #FFFFFF",
  ].join("\n");
  const text = String(source || "");
  return /^\s*@startuml[^\r\n]*/im.test(text)
    ? text.replace(/^(\s*@startuml[^\r\n]*)/im, `$1\n${theme}`)
    : `${theme}\n${text}`;
}

async function deflateForPlantUml(bytes) {
  if (typeof CompressionStream === "undefined") throw new Error("CompressionStream unavailable");
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return compressed.slice(2, -4);
}

function encodePlantUmlBytes(bytes) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    output += appendPlantUml3Bytes(bytes[index], bytes[index + 1] ?? 0, bytes[index + 2] ?? 0);
  }
  return output;
}

function appendPlantUml3Bytes(byte1, byte2, byte3) {
  const c1 = byte1 >> 2;
  const c2 = ((byte1 & 0x3) << 4) | (byte2 >> 4);
  const c3 = ((byte2 & 0xf) << 2) | (byte3 >> 6);
  const c4 = byte3 & 0x3f;
  return encodePlantUml6Bit(c1 & 0x3f)
    + encodePlantUml6Bit(c2 & 0x3f)
    + encodePlantUml6Bit(c3 & 0x3f)
    + encodePlantUml6Bit(c4 & 0x3f);
}

function encodePlantUml6Bit(value) {
  if (value < 10) return String.fromCharCode(48 + value);
  value -= 10;
  if (value < 26) return String.fromCharCode(65 + value);
  value -= 26;
  if (value < 26) return String.fromCharCode(97 + value);
  value -= 26;
  if (value === 0) return "-";
  if (value === 1) return "_";
  return "?";
}

function progressFor(projectId) {
  return state.progress.find((item) => item.projectId === projectId) || {
    currentLessonId: "",
    currentStepId: "",
    currentStep: 0,
    completedSteps: [],
    completedStepIds: [],
    lessonProgress: [],
  };
}

function projectById(projectId) {
  return state.projects.find((project) => project.id === projectId) || null;
}

function primarySourcePath(project) {
  return project?.viewManifest?.primary_source_path || project?.sourceFiles?.[0]?.path || "src/main.cpp";
}

function renderProjectViewManifest(project) {
  return guidedProjectView().renderProjectViewManifest(project);
}

function renderGuidedProject(project) {
  return guidedProjectView().renderProjectViewManifest(project, "#learningProjectArtifact");
}

function guidedViews(project) {
  return guidedProjectView().guidedViews(project);
}

function focusIdeStepSource(project) {
  return guidedProjectView().focusIdeStepSource(project);
}

function summaryItem([label, value]) {
  return DomUtils.summaryItem([label, value]);
}

function meta(label, value) {
  return DomUtils.meta(label, value);
}

async function getJson(url) {
  return ApiClient.getJson(url);
}

async function postJson(url, body) {
  return ApiClient.postJson(url, body);
}

async function putJson(url, body) {
  return ApiClient.putJson(url, body);
}

async function patchJson(url, body) {
  return ApiClient.patchJson(url, body);
}

async function deleteJson(url) {
  return ApiClient.deleteJson(url);
}

function escapeHtml(value) {
  return DomUtils.escapeHtml(value);
}

function escapeAttribute(value) {
  return DomUtils.escapeAttribute(value);
}

function delay(ms) {
  return DomUtils.delay(ms);
}
