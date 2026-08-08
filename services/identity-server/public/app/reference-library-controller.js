const GerNetiXReferenceLibrary = (() => {
  const categories = [
    { id: "all", title: "Alle", symbol: "⌘", description: "Gesamtes Tafelwerk" },
    { id: "programming", title: "Programmieren", symbol: "{ }", description: "Syntax und Muster" },
    { id: "git", title: "Git", symbol: "⑂", description: "Versionierung" },
    { id: "web", title: "Web & HTTP", symbol: "↔", description: "Requests und Status" },
    { id: "data", title: "SQL & Daten", symbol: "▤", description: "Abfragen und Formate" },
    { id: "electronics", title: "Elektronik", symbol: "Ω", description: "Formeln und Einheiten" },
    { id: "embedded", title: "Embedded & IoT", symbol: "▣", description: "Pins und Busse" },
    { id: "terminal", title: "Terminal", symbol: ">_", description: "Dateien und Prozesse" },
  ];

  const entries = [
    { category: "programming", title: "Bedingung", syntax: "if (condition) { ... } else { ... }", detail: "Führt abhängig von einem booleschen Ausdruck genau einen Zweig aus.", tags: "javascript kontrollfluss boolean" },
    { category: "programming", title: "Array durchlaufen", syntax: "items.forEach((item) => { ... });", detail: "Verarbeitet jedes Element. Für ein neues Array eignet sich map().", tags: "javascript array schleife map foreach" },
    { category: "programming", title: "Asynchron warten", syntax: "const result = await operation();", detail: "await darf innerhalb einer async-Funktion verwendet werden und wartet auf ein Promise.", tags: "javascript async promise fehler" },
    { category: "git", title: "Arbeitsstand prüfen", syntax: "git status --short", detail: "Zeigt neue, geänderte und vorgemerkte Dateien in kompakter Form.", tags: "versionierung repository änderungen" },
    { category: "git", title: "Änderungen vergleichen", syntax: "git diff -- path/to/file", detail: "Zeigt nicht vorgemerkte Änderungen einer Datei, ohne etwas zu verändern.", tags: "versionierung unterschied patch" },
    { category: "git", title: "Gezielt committen", syntax: "git add path/to/file\ngit commit -m \"Kurze Beschreibung\"", detail: "Nimmt nur bewusst ausgewählte Dateien in einen Commit auf.", tags: "versionierung stage commit" },
    { category: "web", title: "HTTP-Methoden", syntax: "GET · POST · PUT · PATCH · DELETE", detail: "Lesen · anlegen · vollständig ersetzen · teilweise ändern · entfernen.", tags: "api rest request" },
    { category: "web", title: "Wichtige Statuscodes", syntax: "200 OK · 201 Created · 400 Bad Request\n401 Unauthorized · 403 Forbidden · 404 Not Found · 500 Server Error", detail: "Der Status beschreibt das Ergebnis einer HTTP-Anfrage maschinenlesbar.", tags: "api rest response fehler" },
    { category: "web", title: "JSON senden", syntax: "fetch(url, { method: \"POST\", headers: { \"Content-Type\": \"application/json\" }, body: JSON.stringify(data) })", detail: "Objekte müssen für den Request-Body serialisiert werden.", tags: "api javascript request fetch" },
    { category: "data", title: "Datensätze auswählen", syntax: "SELECT id, name FROM items WHERE active = TRUE ORDER BY name;", detail: "Wählt nur benötigte Spalten und filtert vor der Sortierung.", tags: "sql datenbank lesen filter" },
    { category: "data", title: "Datensatz einfügen", syntax: "INSERT INTO items (name, active) VALUES ($1, $2);", detail: "Parameter statt zusammengesetzter SQL-Strings schützen vor SQL-Injection.", tags: "sql datenbank schreiben parameter" },
    { category: "data", title: "ISO-Datum", syntax: "2026-08-08T14:30:00Z", detail: "ISO 8601 ist eindeutig; Z kennzeichnet UTC. Zeitzonen bei Anzeige bewusst umrechnen.", tags: "json datum zeit utc timezone" },
    { category: "electronics", title: "Ohmsches Gesetz", syntax: "U = R × I\nI = U ÷ R\nR = U ÷ I", detail: "Spannung U in Volt, Strom I in Ampere und Widerstand R in Ohm.", tags: "elektronik formel volt ampere ohm" },
    { category: "electronics", title: "Elektrische Leistung", syntax: "P = U × I\nP = I² × R\nP = U² ÷ R", detail: "Leistung P wird in Watt angegeben und beschreibt Energie pro Zeit.", tags: "elektronik formel watt energie" },
    { category: "electronics", title: "Vorsatzzeichen", syntax: "k = 10³ · m = 10⁻³ · µ = 10⁻⁶ · n = 10⁻⁹", detail: "1 kΩ = 1.000 Ω; 1 mA = 0,001 A; 1 µF = 0,000001 F.", tags: "einheiten kilo milli mikro nano" },
    { category: "embedded", title: "Digitale Pegel", syntax: "LOW = 0 · HIGH = 1", detail: "Die realen Spannungsbereiche hängen vom Board ab. 3,3-V-Pins sind nicht automatisch 5-V-tolerant.", tags: "gpio pin spannung digital" },
    { category: "embedded", title: "I²C", syntax: "SDA = Daten · SCL = Takt", detail: "Mehrere Teilnehmer teilen zwei Leitungen und benötigen eindeutige Adressen sowie meist Pull-up-Widerstände.", tags: "bus sensor adresse pullup" },
    { category: "embedded", title: "UART", syntax: "TX → RX · RX ← TX · gemeinsame GND", detail: "Beide Seiten müssen Baudrate, Datenbits, Parität und Stopbits passend konfigurieren.", tags: "seriell bus baudrate gpio" },
    { category: "terminal", title: "Dateien finden", syntax: "rg --files\nrg \"Suchtext\" path/", detail: "Listet Dateien oder durchsucht Inhalte rekursiv und schnell.", tags: "shell terminal suche ripgrep" },
    { category: "terminal", title: "Verzeichnisinhalt", syntax: "ls -la", detail: "Zeigt auch versteckte Einträge sowie Berechtigungen und Dateigrößen.", tags: "shell terminal dateien ordner" },
    { category: "terminal", title: "Prozess am Port", syntax: "lsof -nP -iTCP:4300 -sTCP:LISTEN", detail: "Ermittelt unter macOS und Linux, welcher Prozess einen TCP-Port belegt.", tags: "shell terminal netzwerk server prozess" },
  ];

  let selectedCategory = "all";
  let eventsBound = false;

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);

  function bind() {
    if (eventsBound) return;
    eventsBound = true;
    const view = document.querySelector("#referenceLibraryView");
    view?.addEventListener("input", (event) => {
      if (event.target.matches("#referenceLibrarySearch")) render();
    });
    view?.addEventListener("click", async (event) => {
      const category = event.target.closest("[data-reference-category]");
      if (category) {
        selectedCategory = category.dataset.referenceCategory;
        render();
        document.querySelector("#referenceLibraryResultsTitle")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const reset = event.target.closest("[data-reference-reset]");
      if (reset) {
        selectedCategory = "all";
        const search = document.querySelector("#referenceLibrarySearch");
        if (search) search.value = "";
        render();
        search?.focus();
        return;
      }
      const copy = event.target.closest("[data-reference-copy]");
      if (!copy) return;
      const entry = entries[Number(copy.dataset.referenceCopy)];
      if (!entry) return;
      try {
        await navigator.clipboard.writeText(entry.syntax);
        const original = copy.textContent;
        copy.textContent = "Kopiert";
        window.setTimeout(() => { copy.textContent = original; }, 1_500);
      } catch {
        copy.textContent = "Kopieren nicht möglich";
      }
    });
  }

  function enter() {
    render();
  }

  function render() {
    const categoryMount = document.querySelector("#referenceLibraryCategories");
    const entriesMount = document.querySelector("#referenceLibraryEntries");
    if (!categoryMount || !entriesMount) return;
    const searchValue = document.querySelector("#referenceLibrarySearch")?.value.trim().toLocaleLowerCase("de") || "";
    const visible = entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => selectedCategory === "all" || entry.category === selectedCategory)
      .filter(({ entry }) => !searchValue || `${entry.title} ${entry.syntax} ${entry.detail} ${entry.tags}`.toLocaleLowerCase("de").includes(searchValue));

    categoryMount.innerHTML = categories.map((category) => {
      const active = category.id === selectedCategory;
      const count = category.id === "all" ? entries.length : entries.filter((entry) => entry.category === category.id).length;
      return `<button class="reference-library-category${active ? " active" : ""}" type="button" data-reference-category="${category.id}" aria-pressed="${active}">
        <span aria-hidden="true">${escapeHtml(category.symbol)}</span>
        <strong>${escapeHtml(category.title)}</strong>
        <small>${escapeHtml(category.description)} · ${count}</small>
      </button>`;
    }).join("");

    const activeCategory = categories.find((category) => category.id === selectedCategory);
    document.querySelector("#referenceLibraryResultsTitle").textContent = activeCategory?.title || "Alle Themen";
    document.querySelector("#referenceLibraryResultCount").textContent = `${visible.length} ${visible.length === 1 ? "Eintrag" : "Einträge"}`;
    entriesMount.innerHTML = visible.map(({ entry, index }) => `<article class="panel reference-library-entry">
      <header><span>${escapeHtml(categories.find((category) => category.id === entry.category)?.title || "")}</span><h3>${escapeHtml(entry.title)}</h3></header>
      <pre><code>${escapeHtml(entry.syntax)}</code></pre>
      <p>${escapeHtml(entry.detail)}</p>
      <button type="button" data-reference-copy="${index}" aria-label="${escapeHtml(`${entry.title} kopieren`)}">Kopieren</button>
    </article>`).join("");
    entriesMount.hidden = visible.length === 0;
    document.querySelector("#referenceLibraryEmpty").hidden = visible.length !== 0;
  }

  return { bind, enter, render };
})();
