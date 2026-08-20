import { loadBoardFeatureCatalog, loadProcessorBoardCatalog, renderDashboard } from "@app/app-dashboard-controller.js";
import { openProjectInIde } from "@app/app-project-controller.js";
import { delay, deleteJson, escapeAttribute, escapeHtml, getJson, meta, postJson, progressFor, putJson } from "@app/app-runtime-utils.js";
import { loadProjectDetail, showSerialServiceChoiceDialog } from "@app/app-shell-controller.js";
import { InformationView } from "@app/information-view.js";
import { registerPlatformComponent } from "@app/platform-components.js";
import { isPublicInformationPage, navigate } from "@app/platform-routing.js";
import { state } from "@app/platform-state.js";
import { GerNetiXSerialService } from "@app/serial-service-client.js";


// Der Zustand selbst bleibt abhaengigkeitsfrei; die Verbindung wird hier erzeugt.
state.serialService = GerNetiXSerialService.create();

if (isPublicInformationPage) document.body.classList.add("public-help-page");

let projectRepositoryCardController = null;

registerPlatformComponent("deviceOnboarding", () => DeviceOnboardingController.create({
  state,
  model: DeviceOnboardingModel,
  getJson,
  postJson,
  loadProcessorBoardCatalog,
  deleteJson,
  delay,
  loadIdeEsptoolModule,
  loadProcessorBoardCatalog,
  loadBoardFeatureCatalog,
  renderDashboard,
  renderDevices,
  renderIdeShell: (...args) => typeof renderIdeShell === "function" ? renderIdeShell(...args) : undefined,
  escapeHtml,
  meta,
  openHelpTopic: InformationView.openDialog,
  showSerialServiceChoiceDialog,
}));

registerPlatformComponent("guidedProjectView", () => GuidedProjectView.create({
  state,
  getJson,
  postJson,
  putJson,
  waitForCompletedBuild: typeof waitForCompletedBuild === "function" ? waitForCompletedBuild : null,
  progressFor,
  escapeHtml,
  escapeAttribute,
  meta,
  openHelpTopic: InformationView.openDialog,
}));

registerPlatformComponent("developmentPlatform", () => DevelopmentPlatform.create({
  state,
  postJson,
  deleteJson,
  loadProcessorBoardCatalog,
  openProjectInIde,
  loadProjectDetail,
  navigate,
  escapeHtml,
  escapeAttribute,
  openHelpTopic: InformationView.openDialog,
  repositoryCard: projectRepositoryCard(),
}));

function projectRepositoryCard() {
  if (!projectRepositoryCardController) {
    projectRepositoryCardController = ProjectRepositoryCard.create({ getJson, escapeHtml, escapeAttribute });
  }
  return projectRepositoryCardController;
}

registerPlatformComponent("projectApp", () => ProjectAppController.create({
    getJson,
    putJson,
    renderer: ProjectAppRenderer,
    escapeHtml,
    escapeAttribute,
    onDevicesChanged(projectId, deviceIds) {
      const project = state.projects.find((item) => item.id === projectId);
      if (!project) return;
      project.linkedDeviceIds = [...deviceIds];
      project.linkedDeviceId = deviceIds[0] || "";
    },
  }));
