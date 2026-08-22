/*
 * Routing-Primitive der angemeldeten Plattform.
 *
 * Lagen zuvor in app-shell-controller.js. Das ist der Orchestrierer: er laedt
 * Route-Bausteine, rendert Ansichten und ruft die Controller. Neun Dateien
 * riefen von unten navigate() und routeName() dort hinauf.
 *
 * Entscheidend ist, dass hier nicht bloss verschoben wurde. navigate() rief
 * am Ende activateCurrentRoute() -- die Orchestrierung selbst. Ein reines
 * Verschieben haette die verkehrte Abhaengigkeit mitgenommen. Stattdessen
 * meldet navigate() jetzt ein Ereignis, auf das der Orchestrierer hoert. Die
 * Richtung ist damit umgedreht: unten meldet, oben reagiert.
 *
 * Diese Datei haengt nur an window und an state.account, das eine Schicht
 * tiefer liegt.
 */
import { state } from "@app/platform-state.js";

const ROUTE_CHANGED_EVENT = "gernetix:route-changed";

const routeMap = {
  dashboard: "dashboardView",
  "hardware-lab": "hardwareLabView",
  about: "aboutView",
  "development-platform": "developmentPlatformView",
  "development-hardware": "developmentHardwareView",
  learn: "learnView",
  applications: "applicationsView",
  nexi: "nexiView",
  "learning-project-overview": "learningProjectOverviewView",
  "learning-project": "learningProjectView",
  "project-app": "projectAppView",
  quiz: "quizView",
  ide: "ideView",
  debug: "debugView",
  "device-management": "deviceManagementView",
  "device-provisioning": "deviceProvisioningView",
  "device-recovery": "deviceRecoveryView",
  "device-inventory": "devicesView",
  downloads: "downloadsView",
  shop: "shopView",
  billing: "billingView",
  community: "communityView",
  messages: "messagesView",
  nachschlagewerke: "referenceLibraryView",
  help: "informationView",
  knowledge: "informationView",
  "account-setup": "accountSetupView",
  auth: "dashboardView",
};

const isServerAuthenticatedAppShell = /^\/app\/(?!auth(?:\/|$))/.test(window.location.pathname);

function routeName() {
  if (/^\/hilfe\/?$/.test(window.location.pathname)) return "help";
  if (/^\/wissen\/?$/.test(window.location.pathname)) return "knowledge";
  if (/^\/app\/development-platform\/hardware\/?$/.test(window.location.pathname)) return "development-hardware";
  if (/^\/app\/device-management\/?$/.test(window.location.pathname)) return "device-management";
  const deviceManagementMatch = window.location.pathname.match(/^\/app\/device-management\/([^/]+)/);
  if (deviceManagementMatch) {
    return {
      provisioning: "device-provisioning",
      inventory: "device-inventory",
      recovery: "device-recovery",
    }[deviceManagementMatch[1]] || "device-provisioning";
  }
  const match = window.location.pathname.match(/^\/app\/([^/]+)/);
  const route = match ? match[1] : "dashboard";
  if (route === "projects") return "learn";
  if (route === "devices") return "device-inventory";
  if (route === "device-recovery") return "device-recovery";
  return routeMap[route] ? route : "dashboard";
}

function navigate(route) {
  const target = new URL(route, window.location.origin);
  if (/^\/app\/auth(?:\/|$)/.test(target.pathname)) {
    window.location.assign(target.pathname + target.search + target.hash);
    return;
  }
  const protectedAppRoute = /^\/app\/(?!auth(?:\/|$))/.test(target.pathname);
  if (protectedAppRoute && !isServerAuthenticatedAppShell && !state.account) {
    window.location.assign(`/app/auth/?next=${encodeURIComponent(target.pathname + target.search)}`);
    return;
  }
  history.pushState({}, "", route);
  window.dispatchEvent(new CustomEvent(ROUTE_CHANGED_EVENT));
}

/*
 * Aus welchem Seitentyp die Adresse stammt, ist eine Frage des Routings --
 * nicht der Verdrahtung. Die Huelle las diese drei Merkmale zuvor von oben
 * aus app.js.
 */
const isPublicHelpPage = /^\/hilfe\/?$/.test(window.location.pathname);
const isPublicKnowledgePage = /^\/wissen\/?$/.test(window.location.pathname);
const isPublicInformationPage = isPublicHelpPage || isPublicKnowledgePage;

export {
  ROUTE_CHANGED_EVENT,
  isPublicInformationPage,
  isPublicKnowledgePage,
  navigate,
  routeMap,
  routeName,
};
