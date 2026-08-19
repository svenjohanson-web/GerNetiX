
const isPublicHelpPage = /^\/hilfe\/?$/.test(window.location.pathname);
const isPublicKnowledgePage = /^\/wissen\/?$/.test(window.location.pathname);
const isPublicInformationPage = isPublicHelpPage || isPublicKnowledgePage;
if (isPublicInformationPage) document.body.classList.add("public-help-page");

let deviceOnboardingController = null;
let guidedProjectViewController = null;
let developmentPlatformController = null;
let projectRepositoryCardController = null;
let learningProjectController = null;
let projectAppController = null;
let quizController = null;
let lastRenderedRoute = "";
let processorBoardCatalogLoadPromise = null;
let boardFeatureCatalogLoadPromise = null;
let platformI18n = null;

function deviceOnboarding() {
  if (!deviceOnboardingController) {
    deviceOnboardingController = DeviceOnboardingController.create({
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
    });
  }
  return deviceOnboardingController;
}

function guidedProjectView() {
  if (!guidedProjectViewController) {
    guidedProjectViewController = GuidedProjectView.create({
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
    });
  }
  return guidedProjectViewController;
}

function developmentPlatform() {
  if (!developmentPlatformController) {
    developmentPlatformController = DevelopmentPlatform.create({
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
    });
  }
  return developmentPlatformController;
}

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
