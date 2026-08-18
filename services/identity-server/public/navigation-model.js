(function exposeGerNetiXNavigationModel(global) {
  const model = {
    anonymous: [
      { href: "/", label: "Startseite", i18n: "nav.home" },
      { href: "/ueber-uns/", label: "Über uns", i18n: "footer.about" },
      { href: "/datenschutz/", label: "Datenschutz", i18n: "footer.privacy" },
      { href: "/nachbauprojekte/nexi-sprachassistent/", label: "Nexi" },
      { href: "/nachbauprojekte/", label: "Projekte zum Nachbauen", i18n: "nav.rebuild_projects" },
      { href: "/technik-labs/", label: "Virtuelles Elektroniklabor" },
      { href: "/flashbox-einrichten/", label: "FlashBox einrichten", i18n: "nav.usb_helper" },
      { href: "/wissen/", label: "Wissensportal", i18n: "nav.knowledge" },
      { href: "/community/", label: "Community", i18n: "nav.community" },
      { href: "/hilfe/", label: "Hilfe", i18n: "nav.help" },
      { href: "/support/", label: "Support", i18n: "nav.support" },
      { href: "/leistungen/", label: "Leistungen", i18n: "nav.services" },
      { href: "/tarife/", label: "Konten & Tarife" },
      { href: "/shop/", label: "Webshop", i18n: "nav.shop" },
      { href: "/app/auth/", label: "Anmelden", i18n: "nav.login" },
    ],
    authenticated: {
      primary: [
        { href: "/app/dashboard/", label: "Übersicht", i18n: "platform.nav.dashboard", route: "dashboard" },
        { href: "/app/applications/", label: "Meine Anwendungen", i18n: "platform.nav.applications", route: "applications" },
      ],
      groups: [
        {
          label: "Lernen & Entwickeln",
          i18n: "platform.menu.learn_develop",
          items: [
            { href: "/app/learn/", label: "Lernplattform", i18n: "platform.nav.learning", route: "learn" },
            { href: "/app/development-platform/", label: "Entwicklungsplattform", i18n: "platform.nav.development", route: "development-platform" },
            { href: "/app/quiz/", label: "Quiz", i18n: "platform.nav.quiz", route: "quiz", className: "utility" },
            { href: "/wissen/", label: "Wissensspeicher", i18n: "platform.nav.knowledge_store", className: "utility public-information-link", badgeId: "knowledgeUpdateMenuBadge" },
            { href: "/app/nachschlagewerke/", label: "Nachschlagewerke", i18n: "platform.nav.reference_library", route: "nachschlagewerke", className: "utility" },
            { href: "/app/community/", label: "Community", i18n: "platform.nav.community", route: "community" },
            { href: "/nachbauprojekte/", label: "Nachbauprojekte", i18n: "nav.rebuild_projects", className: "utility public-information-link" },
          ],
        },
        {
          label: "Boards & Werkzeuge",
          i18n: "platform.menu.boards_tools",
          items: [
            { href: "/app/device-management/", label: "Geräte", i18n: "platform.nav.devices", route: "device-management" },
            { href: "/app/hardware-lab/", label: "KI-Hardware-Assistent", i18n: "platform.nav.hardware_lab", route: "hardware-lab", id: "hardwareLabMenuLink", className: "utility" },
            { href: "/technik-labs/", label: "Virtuelles Elektroniklabor", className: "utility public-information-link" },
            { type: "button", label: "Device-WLAN-Setup", id: "deviceWifiSetupMenuButton", className: "utility menu-tool-action", contexts: ["app"] },
            { href: "/app/downloads/", label: "Downloads", i18n: "platform.nav.downloads", route: "downloads", className: "utility" },
            { href: "/flashbox-einrichten/", label: "FlashBox einrichten", i18n: "nav.usb_helper", className: "utility public-information-link" },
          ],
        },
        {
          label: "Service & Shop",
          i18n: "platform.menu.service_shop",
          items: [
            { href: "/app/about/", label: "Über uns", i18n: "footer.about", route: "about", className: "utility" },
            { href: "/datenschutz/", label: "Datenschutz", i18n: "footer.privacy", className: "utility public-information-link" },
            { href: "/support/", label: "Support", i18n: "nav.support", className: "utility public-information-link" },
            { href: "/leistungen/", label: "Leistungen", i18n: "nav.services", className: "utility public-information-link" },
            { href: "/shop/", label: "Webshop", i18n: "nav.shop", className: "utility public-information-link" },
          ],
        },
        {
          label: "Konto",
          i18n: "platform.menu.account",
          className: "app-menu-group-private",
          items: [
            { href: "/app/account-setup/", label: "Profil", i18n: "profile.menu", route: "account-setup", className: "utility" },
            { href: "/app/billing/", label: "Billing", i18n: "platform.nav.billing", route: "billing", className: "utility" },
          ],
        },
      ],
      fixed: [
        { href: "/hilfe/", label: "Hilfe", i18n: "nav.help", id: "helpMenuLink", className: "utility public-information-link menu-fixed-action" },
        { href: "/app/messages/", label: "Nachrichten", route: "messages", id: "messagesMenuLink", className: "utility menu-fixed-action" },
        { href: "/app/auth/", label: "Anmelden", i18n: "nav.login", id: "loginMenuLink", className: "utility public-information-link menu-session-action", contexts: ["app"] },
        { type: "button", label: "Abmelden", i18n: "platform.nav.logout", id: "logoutButton", className: "menu-logout menu-session-action", contexts: ["app"] },
        { href: "/app/auth/", label: "Abmelden", i18n: "platform.nav.logout", logout: true, contexts: ["public"] },
      ],
    },
  };

  global.GerNetiXNavigationModel = model;
})(window);
