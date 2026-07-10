function developmentProjectSources({ title, description = "", diagram = null, architectureSource = "" }) {
  const source = String(architectureSource || diagram?.source || "").trim();
  const components = detectProjectComponents({ title, description, diagram, source });
  const sources = [
    {
      path: "docs/architecture.puml",
      role: "architecture_model",
      content_type: "text/plain",
      content: source,
    },
    {
      path: "Architektur/statische-architektur/architecture.puml",
      role: "architecture_static_view",
      content_type: "text/plain",
      content: source,
    },
    {
      path: "Architektur/informationsfluss/informationsfluss.md",
      role: "architecture_information_flow",
      content_type: "text/markdown",
      content: informationFlowReadme({ title, components }),
    },
    {
      path: "Architektur/systemverhalten/systemverhalten.md",
      role: "architecture_system_verhalten",
      content_type: "text/markdown",
      content: systemVerhaltenReadme({ title, components }),
    },
  ];

  for (const component of components) {
    const folder = `Komponenten/${component.folder}`;
    sources.push({
      path: `${folder}/Eigenschaften/eigenschaften.md`,
      role: "component_properties",
      content_type: "text/markdown",
      content: componentPropertiesReadme(component),
    });
    sources.push({
      path: `${folder}/Schnittstellen/provided.md`,
      role: "provided_interface",
      content_type: "text/markdown",
      content: interfaceReadme(component, "provided"),
    });
    sources.push({
      path: `${folder}/Schnittstellen/required.md`,
      role: "required_interface",
      content_type: "text/markdown",
      content: interfaceReadme(component, "required"),
    });
    sources.push({
      path: `${folder}/Verhalten/Modell/modell.md`,
      role: "component_verhalten_modell",
      content_type: "text/markdown",
      content: verhaltenReadme(component, "Modell"),
    });
    sources.push({
      path: `${folder}/Verhalten/Code/code.md`,
      role: "component_verhalten_code",
      content_type: "text/markdown",
      content: verhaltenReadme(component, "Code"),
    });
    sources.push({
      path: `${folder}/Verhalten/Config/config.md`,
      role: "component_verhalten_config",
      content_type: "text/markdown",
      content: verhaltenReadme(component, "Config"),
    });
    sources.push({
      path: `${folder}/Daten/daten.md`,
      role: "component_data",
      content_type: "text/markdown",
      content: componentDataReadme(component),
    });
    sources.push({
      path: `${folder}/Beziehungen/beziehungen.md`,
      role: "component_relations",
      content_type: "text/markdown",
      content: componentRelationsReadme(component),
    });
  }

  return sources.filter((item) => item.content);
}

function detectProjectComponents({ title = "", description = "", diagram = null, source = "" }) {
  const text = [
    title,
    description,
    source,
    diagram?.summary,
    ...(diagram?.detected_blocks || []),
  ].join("\n").toLowerCase();
  const has = (patterns) => patterns.some((pattern) => pattern.test(text));
  const components = [];
  const add = (id, name, summary, provided, required, properties = [], data = [], relations = []) => {
    if (components.some((component) => component.id === id)) return;
    components.push({
      id,
      name,
      folder: slugFolder(name),
      summary,
      provided,
      required,
      properties,
      data,
      relations,
    });
  };

  if (has([/esp32/, /iot device/, /\bdevice\b/, /board/, /sensor/, /aktor/, /messung/])) {
    add(
      "esp32",
      "ESP32",
      "Embedded-Komponente fuer lokale Messung, Steuerung, Status oder Device-nahe Logik.",
      ["Device-Status", "lokale Mess-/Steuerereignisse", "optionaler Firmware-/Runtime-Status"],
      ["Stromversorgung", "Hardware-Pins und Peripherie", "optionale Kommunikationsstrecke zu UI, MQTT oder Server"],
      ["Betriebsort: Device", "Ressourcen: begrenzter Speicher und begrenzte Rechenleistung", "Zuverlaessigkeit: lokale Logik muss auch bei Verbindungsstoerung definiert bleiben"],
      ["Messwerte", "Status", "Konfiguration", "Steuerereignisse"],
      ["kann Daten an Kommunikations-, UI- oder Server-Komponenten liefern", "kann Befehle oder Konfiguration von anderen Komponenten benoetigen"],
    );
  }
  if (has([/mqtt/])) {
    add(
      "mqtt-client",
      "MQTT Client",
      "Kommunikationskomponente fuer Publish/Subscribe-Nachrichten zwischen Device, Broker und Backend.",
      ["Publish von Status-, Telemetrie- oder Ereignisnachrichten", "Subscribe auf Befehle oder Konfiguration"],
      ["MQTT Broker", "Topic-Konventionen", "Credentials oder lokale Entwicklungsfreigabe"],
      ["Kommunikationsart: Publish/Subscribe", "Kopplung: entkoppelt Sender und Empfaenger ueber Topics"],
      ["Topics", "Telemetrie", "Befehle", "Statusnachrichten"],
      ["verbindet Device-, Broker- und Backend-Komponenten ueber Nachrichten"],
    );
  }
  if (has([/backend/, /\bserver\b/, /\bapi\b/, /rest/, /websocket/])) {
    add(
      "server",
      "Server",
      "Backend- oder API-Komponente fuer fachliche Verarbeitung, Koordination und externe Schnittstellen.",
      ["HTTP-/API-Endpunkte", "fachliche Services", "optional WebSocket- oder MQTT-Anbindung"],
      ["Persistenz falls fachlicher Zustand entsteht", "Auth-/Account-Kontext falls Nutzerbezug entsteht", "eingehende Device- oder UI-Nachrichten"],
      ["Betriebsort: lokaler Server, Homeserver oder Cloud", "Verantwortung: fachliche Koordination und Schnittstellenbuendelung"],
      ["Requests", "Responses", "Ereignisse", "fachlicher Zustand"],
      ["vermittelt zwischen UI, Device, Persistenz und externen Integrationen"],
    );
  }
  if (has([/browser/, /web app/, /webapp/, /dashboard/, /hmi/])) {
    add(
      "browser-app",
      "Browser App",
      "Bedienoberflaeche im Browser fuer Nutzerinteraktion, Status und Steuerung.",
      ["UI-Aktionen", "Statusanzeige", "Formulare oder Dashboards"],
      ["Server-API oder lokaler Device-Endpunkt", "Session-/Account-Kontext falls geschuetzt"],
      ["Betriebsort: Browser", "Zweck: menschliche Bedienung und Visualisierung"],
      ["UI-Zustand", "Formulareingaben", "angezeigte Messwerte oder Statusinformationen"],
      ["nutzt APIs oder lokale Device-Endpunkte fuer Anzeige und Bedienung"],
    );
  }
  if (has([/mobile/, /handy/, /smartphone/])) {
    add(
      "mobile-app",
      "Mobile App",
      "Mobile Bedienkomponente fuer Smartphone- oder Tablet-Nutzung.",
      ["mobile UI-Aktionen", "Status- und Benachrichtigungsansichten"],
      ["Server-API", "Auth-/Session-Kontext", "optionale Push- oder lokale Netzwerkrechte"],
      ["Betriebsort: mobiles Endgeraet", "Zweck: mobile Bedienung, Anzeige und Benachrichtigung"],
      ["mobiler UI-Zustand", "Benachrichtigungen", "Nutzeraktionen"],
      ["nutzt Server- oder lokale Device-Schnittstellen"],
    );
  }
  if (has([/datenbank/, /sqlite/, /persistenz/, /speicher/, /historie/, /history/])) {
    add(
      "sqlite-database",
      "SQLite Datenbank",
      "SQL-Persistenz fuer fachlichen Zustand gemaess GerNetiX SQL-only-Architekturentscheidung.",
      ["gespeicherte fachliche Daten", "Abfrage- und Update-Operationen ueber Repository/API"],
      ["Schema/Migration", "Owner-Service", "Backup-/Audit-Regeln falls fachlich relevant"],
      ["Persistenzart: SQL/SQLite", "Owner: genau ein fachlich verantwortlicher Service"],
      ["Tabellen", "Datensaetze", "Audit- oder Historieninformationen"],
      ["wird von einem Owner-Service ueber Repository/API genutzt"],
    );
  }
  if (!components.length) {
    add(
      "projektidee",
      "Projektidee",
      "Startkomponente fuer eine noch nicht ausdifferenzierte Architektur.",
      ["Projektziel und erste Randbedingungen"],
      ["Nutzerentscheidung ueber Zielsysteme und Schnittstellen"],
      ["Status: noch nicht ausdifferenziert", "Zweck: Einstiegspunkt fuer Architektur-Discovery"],
      ["Projektziel", "Randbedingungen", "offene Fragen"],
      ["wird in konkrete Komponenten und Architektursichten zerlegt"],
    );
  }
  return components;
}

function informationFlowReadme({ title, components }) {
  return [
    `# Informationsfluss: ${title || "Entwicklungsprojekt"}`,
    "",
    "Diese Sicht sammelt Nachrichten, Datenfluesse, Befehle und Ereignisse zwischen den Komponenten.",
    "",
    "## Startpunkte",
    ...components.map((component) => `- ${component.name}: provided und required Schnittstellen unter \`Komponenten/${component.folder}/Schnittstellen/\`.`),
    "",
    "Required Interfaces werden bewusst genauso sichtbar gemacht wie provided Interfaces.",
    "",
  ].join("\n");
}

function systemVerhaltenReadme({ title, components }) {
  return [
    `# Systemverhalten: ${title || "Entwicklungsprojekt"}`,
    "",
    "Diese Sicht beschreibt komponentenuebergreifende Ablaeufe, Zustaende, Regeln, Ereignisse, Fehlerfaelle und Reaktionen des Gesamtsystems.",
    "",
    "Die KI kann bestaetigtes Systemverhalten spaeter auf Komponentenverhalten, required/provided Schnittstellen, Datenfluesse, Code und Konfiguration dekomponieren.",
    "",
    "## Dekompositionsziele",
    ...components.map((component) => `- ${component.name}: relevante Anteile des Systemverhaltens unter \`Komponenten/${component.folder}/Verhalten/\` ausarbeiten.`),
    "",
  ].join("\n");
}

function componentPropertiesReadme(component) {
  return [
    `# Eigenschaften: ${component.name}`,
    "",
    component.summary,
    "",
    "## Eigenschaften",
    ...listOrPlaceholder(component.properties, "Noch keine bestaetigten Eigenschaften."),
    "",
  ].join("\n");
}

function interfaceReadme(component, kind) {
  const title = kind === "provided" ? "Provided Interfaces" : "Required Interfaces";
  const items = kind === "provided" ? component.provided : component.required;
  return [
    `# ${title}: ${component.name}`,
    "",
    ...items.map((item) => `- ${item}`),
    "",
  ].join("\n");
}

function verhaltenReadme(component, kind) {
  const descriptions = {
    Modell: "Modelle, Zustandsautomaten, Regeln, Ablaufbeschreibungen oder Pseudocode, die das Verhalten der Komponente beschreiben.",
    Code: "Code-nahe Ableitungen, Implementierungsskizzen oder konkrete Quellcodedateien fuer das Verhalten der Komponente.",
    Config: "Konfiguration, Parameter, Topics, Pins, Endpunkte oder Runtime-Einstellungen fuer das Verhalten der Komponente.",
  };
  return [
    `# Verhalten ${kind}: ${component.name}`,
    "",
    descriptions[kind] || "Verhaltensartefakte dieser Komponente.",
    "",
    "Komponentenverhalten kann aus dem uebergreifenden Systemverhalten unter `Architektur/systemverhalten/` dekomponiert werden.",
    "",
    "Diese Inhalte werden aus der Architektur abgeleitet und muessen vor produktiver Nutzung vom Nutzer bestaetigt werden.",
    "",
  ].join("\n");
}

function componentDataReadme(component) {
  return [
    `# Daten: ${component.name}`,
    "",
    "Diese Sicht sammelt Daten, Zustaende, Ereignisse, Konfigurationen und fachliche Objekte dieser Komponente.",
    "",
    "## Datenarten",
    ...listOrPlaceholder(component.data, "Noch keine bestaetigten Datenarten."),
    "",
  ].join("\n");
}

function componentRelationsReadme(component) {
  return [
    `# Beziehungen: ${component.name}`,
    "",
    "Diese Sicht beschreibt, wie diese Komponente fachlich oder technisch mit anderen Komponenten zusammenhaengt.",
    "",
    "## Beziehungen",
    ...listOrPlaceholder(component.relations, "Noch keine bestaetigten Beziehungen."),
    "",
  ].join("\n");
}

function listOrPlaceholder(items, placeholder) {
  const list = (Array.isArray(items) ? items : []).filter(Boolean);
  return list.length ? list.map((item) => `- ${item}`) : [`- ${placeholder}`];
}

function slugFolder(value) {
  const slug = String(value || "Komponente")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "Komponente";
}

module.exports = {
  detectProjectComponents,
  developmentProjectSources,
};
