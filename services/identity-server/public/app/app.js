
// Der Zustand selbst bleibt abhaengigkeitsfrei; die Verbindung wird hier erzeugt.
state.serialService = GerNetiXSerialService.create();

const isPublicHelpPage = /^\/hilfe\/?$/.test(window.location.pathname);
const isPublicKnowledgePage = /^\/wissen\/?$/.test(window.location.pathname);
const isPublicInformationPage = isPublicHelpPage || isPublicKnowledgePage;
if (isPublicInformationPage) document.body.classList.add("public-help-page");

let projectRepositoryCardController = null;
let learningProjectController = null;
let projectAppController = null;
let quizController = null;

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

function projectApp() {
  if (!projectAppController) {
    projectAppController = ProjectAppController.create({
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
    });
  }
  return projectAppController;
}
