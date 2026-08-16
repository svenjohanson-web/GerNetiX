(() => {
  const selection = document.querySelector("[data-selected-course]");
  if (!selection) return;

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("course") || "";
  if (!slug) return;

  const titles = {
    "button-to-smartphone-notification": "Vom Taster zur Smartphone-Benachrichtigung",
    "chicken-coop-door-smartphone-app": "Eigene Smartphone-App für die Hühnerstalltür",
    "esp32-camera-streaming": "ESP32-Kamera – vom ersten Bild zum sicheren Videostream",
    "nexi-voice-assistant": "Nexi Sprachassistent",
    "plant-watering-control": "Pflanzenbewässerung steuern",
    "smart-assistant-ai-automation": "Smarter Assistent mit KI und Automatisierung",
  };
  const access = params.get("access") === "abo" ? "abo" : "kauf";
  const title = titles[slug] || "Ausgewähltes Lernprojekt";
  const message = access === "abo"
    ? "Dieses Lernprojekt benötigt ein passendes aktives Abo oder eine dauerhafte Kursfreischaltung."
    : "Für dieses Lernprojekt fehlt noch die dauerhafte Kursfreischaltung oder ein passendes aktives Abo.";

  selection.hidden = false;
  selection.querySelector("[data-selected-course-title]").textContent = title;
  selection.querySelector("[data-selected-course-message]").textContent = message;
  selection.querySelector("[data-selected-course-back]").href = `/app/learn/?catalog=${encodeURIComponent(slug)}`;
})();
