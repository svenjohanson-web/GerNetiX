// GerNetiX platform module extracted from app.js.
bootstrap();
GerNetiXHardwareLab.bind();

document.querySelector("#mainMenuButton").addEventListener("click", (event) => {
  event.stopPropagation();
  toggleMainMenu();
});
document.querySelector("#logoutButton").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "/app/auth/";
});
document.querySelector("#platformLanguage")?.addEventListener("change", changePlatformLocale);

document.querySelectorAll("[data-open-route]").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.openRoute));
});
document.querySelectorAll(".tabs a[data-route]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    closeMainMenu();
    navigate(link.getAttribute("href"));
  });
});
document.querySelector("#mainMenu").addEventListener("click", (event) => {
  event.stopPropagation();
});
document.querySelector("#platformBreadcrumb").addEventListener("click", (event) => {
  const link = event.target.closest("[data-breadcrumb-route]");
  if (!link) return;
  event.preventDefault();
  if (link.dataset.breadcrumbRoute === "/") {
    window.location.assign("/");
    return;
  }
  navigate(link.dataset.breadcrumbRoute);
});
document.querySelectorAll("[data-device-management-route]").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.deviceManagementRoute));
});
document.querySelector("#enablePushButton")?.addEventListener("click", enablePushNotifications);
document.querySelector("#sendPushTestButton")?.addEventListener("click", sendPushTestNotification);
document.querySelector("#pushProjectSelect")?.addEventListener("change", (event) => { state.activeProjectId = event.target.value; });
document.querySelector("#ideProjectBrowser").addEventListener("click", (event) => {
  const selectedTreeEntry = event.target.closest("[data-ide-tree-path]");
  if (selectedTreeEntry) selectIdeTreePath(selectedTreeEntry.dataset.ideTreePath);
  const communicationSetupButton = event.target.closest("[data-communication-setup]");
  if (communicationSetupButton) {
    openCommunicationSetup();
    return;
  }
  const deviceConnectionsButton = event.target.closest("[data-device-connections]");
  if (deviceConnectionsButton) {
    openDeviceConnections(deviceConnectionsButton.dataset.deviceConnections);
    return;
  }
  const sensorPropertiesButton = event.target.closest("[data-sensor-properties]");
  if (sensorPropertiesButton) {
    openSensorProperties(sensorPropertiesButton.dataset.sensorProperties);
    return;
  }
  const driverManagementButton = event.target.closest("[data-driver-management]");
  if (driverManagementButton) {
    openDriverManagement();
    return;
  }
  const boardPropertiesButton = event.target.closest("[data-board-properties]");
  if (boardPropertiesButton) {
    openBoardProperties(boardPropertiesButton.dataset.boardProperties);
    return;
  }
  const hardwareConfigurationButton = event.target.closest("[data-hardware-configuration]");
  if (hardwareConfigurationButton) {
    navigate(`/app/development-platform/hardware/?project=${encodeURIComponent(state.activeProjectId)}`);
    return;
  }
  const componentFeaturesButton = event.target.closest("[data-component-features]");
  if (componentFeaturesButton) {
    openComponentFeatures(componentFeaturesButton.dataset.componentFeatures, componentFeaturesButton.dataset.componentId);
    return;
  }
  const workerDispatcherButton = event.target.closest("[data-worker-dispatcher-configuration]");
  if (workerDispatcherButton) {
    openWorkerDispatcherConfiguration(workerDispatcherButton.dataset.workerDispatcherConfiguration);
    return;
  }
  const webInterfaceButton = event.target.closest("[data-web-interface]");
  if (webInterfaceButton) {
    openWebInterface();
    return;
  }
  const pwaDashboardButton = event.target.closest("[data-pwa-dashboard]");
  if (pwaDashboardButton) {
    openPwaDashboardView();
    return;
  }
  const button = event.target.closest("[data-source-path]");
  if (button) openIdeSource(button.dataset.sourcePath);
});
document.querySelector("#ideDeviceSelect").addEventListener("change", () => {
  state.activeDeviceId = document.querySelector("#ideDeviceSelect").value;
  syncSelectedDevicePort();
  loadIdeProject();
});
document.querySelector("#openProjectDebugButton")?.addEventListener("click", () => {
  if (!state.activeProjectId) return;
  navigate(`/app/debug/?project=${encodeURIComponent(state.activeProjectId)}`);
});
document.querySelector("#ideBuildProfileSelect")?.addEventListener("change", async (event) => {
  const project = projectById(state.activeProjectId);
  if (!project || event.currentTarget.value !== "debug") return;
  if (state.projectDebugSessions[project.id]?.session) return;
  const accepted = window.confirm("Für eine Debug-Session müssen alle betroffenen IoT-Firmwares erneut als Debug-Firmware gebaut und anschließend per USB, OTA oder FlashBox geflasht werden. Debug-Session jetzt starten?");
  if (!accepted) {
    event.currentTarget.value = "standard";
    return;
  }
  try {
    await persistCurrentSource(project);
    await GerNetiXDeviceDebug.startSession(project);
    setFlashStatus("running", "Debug-Session gestartet. Baue jetzt alle Software-Einheiten und flashe anschließend die betroffenen IoT-Devices.");
  } catch (error) {
    event.currentTarget.value = "standard";
    setFlashStatus("error", error.message);
  }
});
document.querySelector("#communityRefreshButton")?.addEventListener("click", loadCommunity);
document.querySelector("#communityRequestForm")?.addEventListener("submit", submitCommunityRequest);
document.querySelector("#communityQuestionList")?.addEventListener("click", (event) => { const button = event.target.closest("[data-community-question]"); if (button) openCommunityQuestion(button.dataset.communityQuestion); });
document.querySelector("#communityThread")?.addEventListener("submit", submitCommunityAnswer);
document.querySelector("#communityThread")?.addEventListener("click", (event) => { const button = event.target.closest("[data-copy-community-link]"); if (button) copyCommunityQuestionLink(button.dataset.copyCommunityLink); });
document.querySelector("#projectIdeaForm")?.addEventListener("submit", submitProjectIdea);
document.querySelector("#projectIdeaRefreshButton")?.addEventListener("click", () => loadProjectIdeas(true));
document.querySelector("#projectIdeaList")?.addEventListener("click", (event) => { const button = event.target.closest("[data-project-idea]"); if (button) openProjectIdea(button.dataset.projectIdea); });
document.querySelector("#communityPortalSearch")?.addEventListener("input", renderCommunityPortal);
document.querySelector("#communityActivityList")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-community-activity]");
  if (!button) return;
  if (button.dataset.communityActivity === "idea") openProjectIdea(button.dataset.communityActivityId);
  if (button.dataset.communityActivity === "showcase") openProjectShowcase(button.dataset.communityActivityId);
  if (button.dataset.communityActivity === "question") openCommunityQuestion(button.dataset.communityActivityId);
});
document.querySelector("#communityPortalNav")?.addEventListener("click", (event) => { const button = event.target.closest("[data-community-target]"); if (button) document.querySelector(`#${button.dataset.communityTarget}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); });
document.querySelector(".community-challenge")?.addEventListener("click", (event) => { const button = event.target.closest("[data-community-target]"); if (button) document.querySelector(`#${button.dataset.communityTarget}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); });
document.querySelector("#dashboardCommunitySummary")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-dashboard-community-route]");
  if (!button) return;
  navigate(button.dataset.dashboardCommunityRoute);
  if (button.dataset.dashboardCommunityTarget) {
    window.setTimeout(() => document.querySelector(`#${button.dataset.dashboardCommunityTarget}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }
});
document.querySelector("[data-open-community-marketplace]")?.addEventListener("click", () => {
  navigate("/app/shop/");
  window.setTimeout(() => document.querySelector("#communityMarketplace")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
});
document.querySelector("#projectShowcaseForm")?.addEventListener("submit", submitProjectShowcase);
document.querySelector("#projectShowcaseRefreshButton")?.addEventListener("click", () => loadCommunityPortal(true));
document.querySelector("#projectShowcaseList")?.addEventListener("click", (event) => { const button = event.target.closest("[data-project-showcase]"); if (button) openProjectShowcase(button.dataset.projectShowcase); });
document.querySelector("#refreshCommunityMarketplaceButton")?.addEventListener("click", () => loadCommunityMarketplace(true));
document.querySelector("#communityMarketplaceForm")?.addEventListener("submit", submitCommunityMarketplaceListing);
document.querySelector("#communityMarketplaceListings")?.addEventListener("click", (event) => { const button = event.target.closest("[data-marketplace-listing]"); if (button) openCommunityMarketplaceListing(button.dataset.marketplaceListing); });
document.querySelector("#messageFolders")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-message-folder]");
  if (!button) return;
  state.messages.folder = button.dataset.messageFolder;
  state.messages.activeThreadId = "";
  document.querySelector("#messageReadingPane").innerHTML = `<div class="message-empty-state"><strong>Wähle eine Nachricht</strong><p>Die Unterhaltung wird hier geöffnet.</p></div>`;
  loadMessages();
});
document.querySelector("#messageThreadList")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-message-thread]");
  if (button) openMessageThread(button.dataset.messageThread);
});
document.querySelector("#messageReadingPane")?.addEventListener("submit", submitMessageReply);
document.querySelector("#messageReadingPane")?.addEventListener("click", (event) => { if (event.target.closest("[data-message-archive]")) toggleMessageArchive(); });
document.querySelector("#messageRefreshButton")?.addEventListener("click", loadMessages);
document.querySelector("#messageComposeButton")?.addEventListener("click", () => document.querySelector("#messageComposeDialog").showModal());
document.querySelector("#messageComposeForm")?.addEventListener("submit", submitNewMessage);
document.querySelector("#messageComposeDialog")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget || event.target.closest("[data-close-message-compose]")) event.currentTarget.close();
});
document.querySelector("#flashboxDeviceSelect").addEventListener("change", () => {
  state.activeFlashboxDeviceId = document.querySelector("#flashboxDeviceSelect").value;
});
document.querySelector("#usbPortMissingDialog")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget || event.target.closest("[data-close-usb-port-missing]")) event.currentTarget.close();
});
document.querySelector("#retryUsbPortSearchButton")?.addEventListener("click", retryUsbPortSearch);
document.querySelector("#usbPortChoiceDialog")?.addEventListener("click", (event) => {
  const identifyButton = event.target.closest("[data-identify-usb-flash-port]");
  if (identifyButton) {
    identifyUsbFlashPortForFirmware(projectById(state.activeProjectId), identifyButton.dataset.identifyUsbFlashPort);
    return;
  }
  if (event.target === event.currentTarget || event.target.closest("[data-close-usb-port-choice]")) {
    stopUsbFlashPortIdentification();
    event.currentTarget.close();
  }
});
document.querySelector("#usbPortChoiceDialog")?.addEventListener("close", () => stopUsbFlashPortIdentification());
document.querySelector("#usbPortIdentificationDialog")?.addEventListener("click", (event) => {
  if (event.target.closest("[data-cancel-usb-port-identification]")) closeUsbPortIdentificationDialog({ cancelDetection: true });
  if (event.target.closest("[data-finish-usb-port-identification]")) closeUsbPortIdentificationDialog();
});
document.querySelector("#usbPortIdentificationDialog")?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeUsbPortIdentificationDialog({ cancelDetection: true });
});
document.querySelector("#usbPortChoiceDialog")?.addEventListener("change", (event) => {
  const select = event.target.closest("[data-usb-firmware-port-select]");
  if (!select) return;
  updateUsbFirmwarePortAssignment(projectById(state.activeProjectId), select.dataset.usbFirmwarePortSelect, select.value);
});
document.querySelector("#confirmUsbPortButton")?.addEventListener("click", () => {
  const dialog = document.querySelector("#usbPortChoiceDialog");
  if (dialog?.dataset.usbChoiceMode === "single-device-conflict") {
    dialog.close();
    if (state.pendingUsbFlash?.mode === "flash") retryUsbPortSearch();
    else startUsbFlash(true);
    return;
  }
  const project = projectById(state.activeProjectId);
  if (!project) return;
  startUsbFlashAssignmentBatch(project);
});
document.querySelector("#usbFirmwareTargetSelect")?.addEventListener("change", renderUsbPortMappingConfirmationState);
document.querySelector("#usbPortSelect")?.addEventListener("change", renderUsbPortMappingConfirmationState);
document.querySelector("#usbInventoryUnknownDialog")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget || event.target.closest("[data-close-usb-inventory-unknown]")) event.currentTarget.close();
});
document.querySelector("#usbInventoryUnknownDialog")?.addEventListener("close", persistUsbInventoryWarningPreference);
document.querySelector("#continueUnknownInventoryUsbFlashButton")?.addEventListener("click", () => {
  persistUsbInventoryWarningPreference();
  if (usbFlashAssignmentBatch) usbFlashAssignmentBatch.inventoryCheckConfirmed = true;
  document.querySelector("#usbInventoryUnknownDialog")?.close();
  startUsbFlash(true, true, true);
});
document.querySelector("#addUnknownUsbDeviceToInventoryButton")?.addEventListener("click", () => {
  persistUsbInventoryWarningPreference();
  document.querySelector("#usbInventoryUnknownDialog")?.close();
  navigate("/app/device-management/provisioning/");
});
document.querySelector("#buildButton").addEventListener("click", handleBuildButtonAction);
document.querySelector("#cancelBuildConfirmDialog")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget || event.target.closest("[data-close-cancel-build]")) event.currentTarget.close();
});
document.querySelector("#confirmCancelBuildButton")?.addEventListener("click", confirmCancelActiveBuilds);
document.querySelector("#cleanBuildButton").addEventListener("click", cleanProjectBuildCache);
document.querySelector("#flashTargetChoiceDialog")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget || event.target.closest("[data-close-flash-target-choice]")) {
    state.pendingFlashAction = "";
    event.currentTarget.close();
  }
});
document.querySelector("#confirmFlashTargetButton")?.addEventListener("click", confirmFlashTargetChoice);
document.querySelector("#ideSoftwareUnitSelect").addEventListener("change", (event) => {
  if (!state.activeProjectId) return;
  state.activeSoftwareUnitIds[state.activeProjectId] = event.target.value;
  updateIdeProjectTools(projectById(state.activeProjectId));
});
document.querySelector("#usbFlashButton").addEventListener("click", () => startUsbFlash());
document.querySelector("#otaFlashButton").addEventListener("click", () => startOtaFlash());
document.querySelector("#flashBoxFlashButton").addEventListener("click", () => startFlashBoxFlash());
document.querySelector("#checkOtaConnectivityButton").addEventListener("click", checkAllocatedDeviceConnectivity);
document.querySelector("#clearIdeTerminalButton").addEventListener("click", clearIdeTerminal);
document.querySelector("#showIdeTerminalButton").addEventListener("click", () => setIdeConsoleView("terminal"));
document.querySelector("#showIdeProjectInformationButton").addEventListener("click", () => setIdeConsoleView("project-information"));
document.querySelector("#showIdeBuildResultsButton").addEventListener("click", () => setIdeConsoleView("build-results"));
document.querySelector("#buildList")?.addEventListener("click", (event) => { const button = event.target.closest("[data-project-version-action]"); if (button) handleProjectVersionAction(button); });
document.querySelector("#projectVersionForm")?.addEventListener("submit", submitProjectVersion);
document.querySelector("#projectVersionDialog")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget || event.target.closest("[data-close-project-version]")) event.currentTarget.close();
});
document.querySelector("#showIdeProjectHintsButton").addEventListener("click", () => setIdeConsoleView("hints"));
document.querySelector("#sourceEditor").addEventListener("input", () => markIdeSourceDirty());
initializeIdeWorkspaceResize();
document.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
  if (document.querySelector("#ideView")?.classList.contains("hidden") || !state.activeProjectId) return;
  event.preventDefault();
  saveSource();
});
document.querySelector("#ideComponentFeaturesView").addEventListener("submit", (event) => {
  if (event.target.matches(".device-web-toolbar")) {
    loadDeviceWebPreview(event);
    return;
  }
  if (event.target.matches("[data-event-configuration-form]")) {
    saveEventConfiguration(event);
    return;
  }
  saveComponentFeatures(event);
});
document.querySelector("#ideComponentFeaturesView").addEventListener("click", (event) => {
  const tab = event.target.closest("[data-web-interface-tab]");
  if (!tab) return;
  state.webInterfaceTab = tab.dataset.webInterfaceTab;
  renderWebInterface(projectById(state.activeProjectId));
});
document.querySelector("#ideComponentFeaturesView").addEventListener("change", (event) => {
  const form = event.target.closest("[data-communication-setup-form]");
  if (form) refreshCommunicationSetupPreview(form);
});
document.querySelector("#idePwaDashboardView").addEventListener("click", (event) => {
  if (event.target.closest("[data-open-pwa-dashboard-editor]")) openPwaDashboardEditor();
});
document.querySelector("#pwaDashboardEditorForm").addEventListener("submit", savePwaDashboard);
document.querySelector("#pwaDashboardDialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget || event.target.closest("[data-close-pwa-dashboard-editor]")) {
    event.currentTarget.close();
  }
});
document.querySelector("#ideBoardPropertiesView").addEventListener("click", (event) => {
  const saveBoardButton = event.target.closest("[data-save-ide-board-configuration]");
  if (saveBoardButton) {
    void saveIdeBoardConfiguration(saveBoardButton.dataset.saveIdeBoardConfiguration === "account");
    return;
  }
  if (event.target.closest("[data-open-hardware-configuration]")) {
    navigate(`/app/development-platform/hardware/?project=${encodeURIComponent(state.activeProjectId)}`);
  }
});
document.querySelector("#ideSensorPropertiesView").addEventListener("click", (event) => {
  if (event.target.closest("[data-open-hardware-configuration]")) navigate(`/app/development-platform/hardware/?project=${encodeURIComponent(state.activeProjectId)}`);
});
document.querySelector("#ideDeviceConnectionsView").addEventListener("click", (event) => {
  if (event.target.closest("[data-open-hardware-configuration]")) navigate(`/app/development-platform/hardware/?project=${encodeURIComponent(state.activeProjectId)}`);
});
document.querySelector("#ideDriverManagementView").addEventListener("click", handleDriverManagementClick);
document.querySelector("#ideDriverManagementView").addEventListener("submit", saveMotorDriverAssignment);
document.querySelector("#recoveryDeviceSelect").addEventListener("change", () => {
  state.activeRecoveryDeviceId = document.querySelector("#recoveryDeviceSelect").value;
  state.recoveryCheckResult = null;
  renderDeviceRecovery();
});
document.querySelector("#refreshRecoveryDevicesButton").addEventListener("click", refreshRecoveryDevices);
document.querySelector("#recoveryCheckUsbButton").addEventListener("click", () => checkRecoveryFirmware("usb"));
document.querySelector("#recoveryCheckOtaButton").addEventListener("click", () => checkRecoveryFirmware("ota"));
document.querySelectorAll('input[name="deviceDiscoveryMethod"]').forEach((input) => {
  input.addEventListener("change", selectDeviceDiscoveryMethod);
});
document.querySelector("#deviceDiscoverySearchButton").addEventListener("click", searchDevicesForInventory);
document.querySelector("#scanProvisioningSerialPortsButton").addEventListener("click", scanProvisioningSerialPorts);
document.querySelector("#selectProvisioningSerialPortButton").addEventListener("click", selectProvisioningSerialPort);
document.querySelector("#provisioningSerialServicePortSelect").addEventListener("change", selectProvisioningSerialPort);
document.querySelector("#checkProvisioningSerialPortButton").addEventListener("click", identifyEsp32Bootloader);
document.querySelector("#flashProvisioningBasissoftwareButton").addEventListener("click", flashProvisioningBasissoftware);
document.querySelector("#scanProvisioningWifiButton").addEventListener("click", scanProvisioningWifiNetworks);
document.querySelector("#connectProvisioningWifiButton").addEventListener("click", connectProvisioningWifi);
document.querySelector("#avrBootloaderIdentifyButton").addEventListener("click", identifyAvrBootloaderExperimental);
document.querySelector("#claimSelectedDiscoveredDevicesButton").addEventListener("click", claimSelectedDiscoveredDevices);
document.querySelector("#inventoryBoardShortName").addEventListener("input", syncInventoryNodeNamePreview);
document.querySelector("#createOfflineRecoverySetButton")?.addEventListener("click", createOfflineRecoverySet);
document.querySelector("#confirmOfflineRecoverySetButton")?.addEventListener("click", () => document.querySelector("#offlineRecoverySetDialog")?.close());
document.querySelector("#offlineRecoverySetDialog")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget || event.target.closest("[data-close-offline-recovery-set]")) event.currentTarget.close();
});
document.querySelector("#serialServiceChoiceDialog")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget || event.target.closest("[data-close-serial-service-choice]")) event.currentTarget.close();
});
document.querySelector("#serialServiceChoiceInstall")?.addEventListener("click", () => {
  const status = document.querySelector("#serialServiceChoiceStatus");
  if (status && preferredSerialServiceDownload()) {
    status.textContent = "Download gestartet. Öffne das geladene Installationspaket; der WebHelper startet danach automatisch.";
  }
});
document.querySelector("#flashboxConfigForm")?.addEventListener("change", renderShopConfiguration);
document.querySelector("#createFlashboxMockOrderButton")?.addEventListener("click", createFlashboxMockOrder);
document.querySelector("#flashboxClaimForm")?.addEventListener("submit", claimFlashboxFromCode);
window.addEventListener("popstate", renderRoute);
document.addEventListener("click", closeMainMenu);
