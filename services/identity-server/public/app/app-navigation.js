(function renderGerNetiXAppNavigation() {
  const menu = document.querySelector("#mainMenu");
  const model = window.GerNetiXNavigationModel?.authenticated;
  if (!menu || !model) return;

  const isVisible = (item) => !item.contexts || item.contexts.includes("app");

  function createItem(item) {
    const element = document.createElement(item.type === "button" ? "button" : "a");
    if (item.type === "button") element.type = "button";
    else element.href = item.href;
    if (item.id) element.id = item.id;
    if (item.className) element.className = item.className;
    if (item.route) element.dataset.route = item.route;

    const label = document.createElement(item.badgeId ? "span" : "span");
    label.textContent = item.label;
    if (item.i18n) label.dataset.i18n = item.i18n;
    element.append(label);

    if (item.badgeId) {
      element.append(document.createTextNode(" "));
      const badge = document.createElement("span");
      badge.id = item.badgeId;
      badge.className = "knowledge-update-count";
      badge.hidden = true;
      element.append(badge);
    }
    return element;
  }

  function createGroup(group) {
    const details = document.createElement("details");
    details.className = ["app-menu-group", group.className].filter(Boolean).join(" ");
    const summary = document.createElement("summary");
    summary.textContent = group.label;
    if (group.i18n) summary.dataset.i18n = group.i18n;
    const content = document.createElement("div");
    content.append(...group.items.filter(isVisible).map(createItem));
    details.append(summary, content);
    return details;
  }

  menu.replaceChildren(
    ...model.primary.filter(isVisible).map(createItem),
    ...model.groups.map(createGroup),
    ...model.fixed.filter(isVisible).map(createItem),
  );
})();
