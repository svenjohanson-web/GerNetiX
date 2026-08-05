(() => {
  if (/^\/app\/hardware-lab\/?$/.test(window.location.pathname)) {
    document.documentElement.classList.add("initial-hardware-lab-route");
    const style = document.createElement("style");
    style.textContent = "html.initial-hardware-lab-route #dashboardView{display:none}html.initial-hardware-lab-route .app-shell{padding-top:0}html.initial-hardware-lab-route .topbar{position:fixed;top:0;right:22px;left:22px;z-index:60}";
    document.head.append(style);
  }
})();
