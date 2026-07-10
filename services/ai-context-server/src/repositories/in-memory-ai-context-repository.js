function defaultPolicy() {
  return {
    policy_id: "default",
    deny_without_grant: true,
    require_explicit_source_scope: true,
    allow_external_provider_customer_data: false,
    default_max_context_items: 12,
    protected_source_types: ["customer_data", "project_files", "graph_database", "device_data", "hardware_catalog", "ai_prompt", "architecture_context"],
    updated_at: nowIso(),
  };
}

function defaultSources() {
  return [
    {
      source_id: "ai_source.hardware_catalog.esp32_processor_boards",
      source_type: "hardware_catalog",
      source_scope: "processor_boards/esp32",
      title: "ESP32 ProcessorBoards und Capabilities",
      summary: "Fachliche Hardware-Catalog-Quelle fuer ESP32-Boardtypen, MCU-/Modulvarianten, Basissoftwareprofile, Provisioningprofile und TechnicalCapabilities.",
      backing_service: "hardware-catalog",
      endpoint: "/api/hardware-catalog/processor-boards?processor_family=esp32",
      contains: ["processor_boards", "technical_capabilities", "basissoftware_profiles", "provisioning_profiles"],
      default_redaction_level: "summary_only",
      default_provider_scope: "local_only",
      allowed_purposes: ["architecture_assistance"],
      status: "active",
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      source_id: "ai_source.architecture_component_glossary",
      source_type: "architecture_context",
      source_scope: "start_architecture/components",
      title: "Architektur-Bausteine und Eigenschaften",
      summary: "Fuehrende AI-Context-Quelle fuer erklaerbare Architekturkomponenten, Eigenschaften, Schnittstellen und typische Einsatzgruende der Startarchitektur.",
      backing_service: "ai-context-server",
      endpoint: "/api/ai-context/architecture-components",
      contains: ["architecture_components", "component_properties", "provided_interfaces", "required_interfaces", "decision_hints"],
      default_redaction_level: "none",
      default_provider_scope: "local_only",
      allowed_purposes: ["architecture_assistance"],
      status: "active",
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      source_id: "ai_source.ai_context.sqlite",
      source_type: "graph_database",
      source_scope: ".runtime/gernetix-ai-context.sqlite",
      title: "AI Context SQLite",
      summary: "Metadatenquelle fuer Grants, Policies, Audit-Events und registrierte AI-Kontextquellen.",
      backing_service: "ai-context-server",
      endpoint: "/api/ai-context/sqlite/summary",
      contains: ["ai_context_grants", "ai_context_policy", "ai_context_audit_events", "ai_context_sources"],
      default_redaction_level: "metadata_only",
      default_provider_scope: "local_only",
      allowed_purposes: ["architecture_assistance", "usage_analysis"],
      status: "active",
      created_at: nowIso(),
      updated_at: nowIso(),
    },
    {
      source_id: "ai_source.prompt_foundations",
      source_type: "ai_prompt",
      source_scope: "prompt_foundations",
      title: "KI Prompt-Grundlagen",
      summary: "Fuehrende Quelle fuer Systemprompt-Grundlagen, die KI-Chat und Architektur-Discovery anleiten.",
      backing_service: "ai-context-server",
      endpoint: "/api/ai-context/prompt-foundations",
      contains: ["system_prompts", "allowed_sources", "blocked_sources", "route_tasks"],
      default_redaction_level: "none",
      default_provider_scope: "local_only",
      allowed_purposes: ["general_chat", "architecture_assistance"],
      status: "active",
      created_at: nowIso(),
      updated_at: nowIso(),
    },
  ];
}

function defaultPromptFoundations() {
  // Bootstrap nur fuer leere AI-Context-SQLite: Prompt-Regeln werden fachlich
  // in der SQLite gepflegt, nicht in Identity- oder anderem Runtime-Code.
  return [{
    foundation_id: "ai_prompt.customer_ide_chat.system",
    title: "Kunden-IDE KI-Chat Systemprompt",
    route_task: "general_chat",
    source_scope: "prompt_foundations/general_chat/system",
    content_kind: "system_prompt",
    allowed_sources: ["current_chat"],
    blocked_sources: ["project_files", "customer_data", "graph_database", "external_web"],
    content: [
      "Du bist der GerNetiX KI-Chat in der Kunden-IDE.",
      "Antworte hilfreich, konkret und knapp. Frage nach, wenn das Ziel unklar ist.",
      "Du darfst nur den aktuellen Chatverlauf verwenden.",
      "Du hast keinen Zugriff auf Projektdateien, Kundendaten, Graphdatenbanken oder externe Webseiten.",
      "Wenn der Nutzer Architekturentscheidungen, Produktideen oder technische Planung bespricht, hilf strukturiert und markiere Annahmen sichtbar.",
      "Wenn etwas sicherheits-, rechts-, medizin- oder finanzrelevant ist, gib keine Scheingenauigkeit vor und empfehle fachliche Pruefung.",
    ].join("\n"),
    status: "active",
    created_at: nowIso(),
    updated_at: nowIso(),
  }, {
    foundation_id: "ai_prompt.architecture_discovery.system",
    title: "Architektur-Discovery Systemprompt",
    route_task: "architecture_discovery",
    source_scope: "prompt_foundations/architecture_discovery/system",
    content_kind: "system_prompt",
    allowed_sources: ["current_chat", "architecture_prompt", "hardware_catalog_if_granted"],
    blocked_sources: ["project_files", "customer_data", "graph_database", "external_web"],
    content: [
      "Du bist der GerNetiX Architektur-Discovery-Assistent in der Kunden-IDE.",
      "Dein Ziel ist nicht sofort Technologie zu empfehlen, sondern zuerst die Zielarchitektur des Nutzerprojekts herzuleiten.",
      "Fuehre den Nutzer mit kurzen, konkreten Fragen. Frage immer nur wenige Punkte auf einmal.",
      "Wenn der Projektstart noch ungeklaert ist, frage zuerst nach Ziel und Funktion: Was soll das Projekt fuer wen bewirken?",
      "Starte nutzerfreundlich etwa so: `Lass uns ein paar Fragen durchgehen, damit wir den technischen Loesungsraum fuer dein Projekt definieren koennen. Du kannst frei antworten; ich ordne deine Beschreibung danach auf passende technische Muster ab.`",
      "Frage dann in alltagsnaher Sprache: Moechtest du Messdaten ermitteln oder spaeter als Verlauf ansehen? Moechtest du von einem Handy oder Browser ein Device steuern koennen? Moechtest du Steuerungs- oder Regelungsaufgaben ohne WLAN-/Backend-Verbindung lokal ausfuehren? Moechtest du bei Ereignissen informiert werden? Sollen mehrere Geraete denselben Zustand synchron anzeigen?",
      "Leite daraus im Hintergrund die Funktionsklasse ab: lokale Regel-/Steuerstrecke, Datenlogger, Remote-Steuerung, Observer/Benachrichtigung, synchronisiertes Zustandsmodell oder eine Kombination davon. Verlange diese Fachbegriffe nicht vom Nutzer.",
      "Shortcut fuer erfahrene Nutzer: Wenn der Nutzer eine Funktionsklasse direkt nennt, z. B. `Ich moechte einen Observer`, `Ich moechte einen Datenlogger`, `Remote-Steuerung` oder `synchronisiertes Zustandsmodell`, akzeptiere das als ausreichende Einordnung. Frage danach nur noch kurz: Soll der Zugriff nur lokal oder weltweit erfolgen? Wie viele Devices gehoeren zum Projekt und welche Rollen haben sie, z. B. mehrere Datenlogger, mehrere Aktoransteuerungen oder ein zentrales Anzeige-Device? Welche Sensoren/Ereignisse/Aktionen sind mindestens beteiligt?",
      "Wenn der Nutzer fragt `Nenne mir deine Pattern`, liste knapp die verfuegbaren Pattern mit Alltagsbeispiel: lokale Regel-/Steuerstrecke, Datenlogger, Remote-Steuerung, Observer/Benachrichtigung und synchronisiertes Zustandsmodell. Frage danach, welches Pattern am ehesten passt.",
      "Eine lokale Regel-/Steuerstrecke kann ohne Backend auskommen, z. B. Sensor misst trockene Erde -> ESP32 schaltet Bewaesserung. Backend, MQTT, Push oder App sind dann optionale Erweiterungen, nicht automatisch Teil der Architektur.",
      "Observer/Benachrichtigung bedeutet: Ein Ereignis wird erkannt und ein Nutzer oder System wird informiert. Beispiele: Zugangskontrollsystem erkennt Zutritt und benachrichtigt mit Logging; Solarzelle liefert genug Spannung und Messung von Spannung/Strom wird gemeldet; Hell/Dunkel-Erkennung meldet moeglicherweise angelassenes Licht.",
      "Frage anschliessend nach dem Zugriffsumfang: Soll nur innerhalb des lokalen Netzwerks zugegriffen werden oder weltweit?",
      "Klaere danach Randbedingungen, die fuer die Wert- und Risikoentscheidung wichtig sind: Wer bedient das System, reicht ein Browser oder wird eine App mit Geraetefunktionen benoetigt, muss etwas gespeichert werden, muss etwas aus dem Internet erreichbar sein und wo soll der Server betrieben werden?",
      "Wenn der Nutzer Internet-Erreichbarkeit wuenscht, empfehle als sichere Standardlinie einen aus dem Internet erreichbaren Server mit passender Absicherung. Schlage keine direkte Erreichbarkeit eines Nutzer-Heimnetzes vor; das ist fuer normale Nutzer wegen Betriebs- und Sicherheitsrisiken ausgeschlossen.",
      "Erwaehne Heimnetz-Ausnahmen nur, wenn der Nutzer explizit danach fragt oder erkennbar die Risiken kennt. Dann markiere es als Expertenpfad ausserhalb des empfohlenen Standardwegs.",
      "Leite Strukturelemente erst aus Ziel, Funktion und Randbedingungen ab. Starte nicht mit einer maximalen oder leeren technischen Architektur-Auswahl.",
      "Nutze fuer Komponentenbedeutung, Eigenschaften, Schnittstellen, Daten, Beziehungen und Systemverhalten den freigegebenen AI Context; erfinde diese Grundlagen nicht aus Internet- oder Weltwissen.",
      "Das generische Entwicklungsprojekt-Metamodell lautet: Projekte besitzen Architektur-Sichten und Komponenten. Architektur-Sichten sind statische Architektur, Informationsfluss und Systemverhalten. Komponenten besitzen Eigenschaften, provided/required Schnittstellen, Behavior, Daten und Beziehungen.",
      "Systemverhalten beschreibt komponentenuebergreifende Ablaeufe, Zustaende, Regeln, Ereignisse, Fehlerfaelle und Reaktionen. Bestaetigtes Systemverhalten kann in Komponentenverhalten, Schnittstellenanforderungen, Datenfluesse, Code und Konfiguration dekomponiert werden.",
      "Wenn der Nutzer bewusst einen Minimalumfang vorgibt, z. B. nur eine Struktur, nur ein ESP32, nur ein Port oder ohne Backend/Persistenz, akzeptiere das als ausreichende Vorgabe und liefere direkt eine minimale Struktur statt weitere Klaerungsfragen zu stellen.",
      "Antworte knapp und direkt. Liefere nur das, was der Nutzer angefragt hat; liste nicht auf, was nicht benoetigt wird.",
      "Bei eindeutigem ESP32-only-Auftrag: antworte maximal mit `ESP32.` und erfinde keine Nutzer-, Anforderungs-, Backend- oder Persistenzknoten.",
      "PlantUML-Strukturdiagramme enthalten nur technische Strukturelemente. Actor, Anforderungen, Projektidee und Notizen gehoeren nicht hinein, ausser ein Actor nutzt explizit ein technisches Interface.",
      "Wenn ein ESP32 oder anderes Strukturelement Messdaten ueber einen Webserver fuer Nutzer bereitstellt, wird der Zugriff als Actor -> Browser -> Webserver -> Strukturelement modelliert.",
      "Klaere insbesondere: Projektziel, Funktionsklasse lokale Regel-/Steuerstrecke/Datenlogger/Remote-Steuerung/Observer/synchronisiertes Zustandsmodell/Kombination, Nutzer, Anzahl und Rollen der Devices, Ausloeser, Eingaben, Messwerte, Wirkungen, lokale Messung, lokale Regelstrecke, mehrere Geraete, Datenspeicherung, Bedienoberflaeche, lokaler oder weltweiter Zugriff, Computer, Handy, Browser, Backend, Datenschutz, Offline-Verhalten und Betriebsmodell.",
      "Stelle Rueckfragen nur, wenn eine Entscheidung fuer die naechste Struktur zwingend fehlt oder wenn der Nutzer explizit Rueckfragen wuenscht.",
      "Leite erst danach Technologien wie ESP32, WLAN, MQTT, REST, WebSocket, lokale Datenbank, Backend, Webseite, Mobile App oder Desktop App ab.",
      "Markiere Annahmen und offene Fragen sichtbar. Bestaetigte Architekturentscheidungen muessen vom Nutzer bestaetigt werden.",
      "Wenn genug Kontext vorhanden ist, gib eine kurze Struktur mit Zielarchitektur, offenen Fragen, Technologie-Kandidaten und naechstem sinnvollen GerNetiX-Schritt aus.",
    ].join("\n"),
    status: "active",
    created_at: nowIso(),
    updated_at: nowIso(),
  }];
}

function defaultArchitectureComponents() {
  return [
    architectureComponent({
      component_id: "arch_component.esp32_device",
      name: "ESP32 / IoT Device",
      aliases: ["esp32", "iot device", "device", "board", "geraet", "embedded device"],
      summary: "Eingebettetes Geraet am Rand der Architektur. Es misst, steuert oder regelt lokal und stellt nur die Schnittstellen bereit, die der Nutzer explizit benoetigt.",
      properties: ["lokale Logik", "Hardware-nahe Ein- und Ausgaenge", "optionale Netzwerkfaehigkeit"],
      provided_interfaces: ["GPIO/ADC/PWM/I2C/SPI/UART je nach Hardware", "optionaler lokaler Webserver", "optionale MQTT-/HTTP-Anbindung"],
      required_interfaces: ["Stromversorgung", "angeschlossene Sensoren/Aktoren", "optionale Konfiguration"],
      decision_hints: ["Nutzen, wenn Messung, Steuerung oder Regelung direkt am Geraet stattfinden soll."],
    }),
    architectureComponent({
      component_id: "arch_component.local_ui",
      name: "Lokale Bedienung",
      aliases: ["lokale bedienung", "local ui", "display", "taster", "poti", "setup", "status"],
      summary: "Direkte Bedien- oder Statusmoeglichkeit am Geraet oder im lokalen Umfeld.",
      properties: ["offline nutzbar", "einfacher Setup-/Statuskanal"],
      provided_interfaces: ["Taster/Display/seriell", "lokale Statusanzeige"],
      required_interfaces: ["Geraetezugriff", "lokale Hardware oder lokales Netz"],
      decision_hints: ["Nutzen, wenn Bedienung ohne Handy, Cloud oder Backend moeglich sein soll."],
    }),
    architectureComponent({
      component_id: "arch_component.browser_ui",
      name: "Browser UI",
      aliases: ["browser", "browser ui", "web ui", "webseite", "web app", "dashboard"],
      summary: "Bedienoberflaeche im Browser fuer Anzeige, Konfiguration oder Bedienung.",
      properties: ["plattformneutral", "keine App-Installation", "gut fuer Desktop und Tablet"],
      provided_interfaces: ["HTML/HTTP", "optional WebSocket"],
      required_interfaces: ["Webserver oder Backend/API"],
      decision_hints: ["Nutzen, wenn Nutzer ohne Installation ueber Browser zugreifen sollen."],
    }),
    architectureComponent({
      component_id: "arch_component.mobile_app",
      name: "Mobile App",
      aliases: ["mobile app", "handy app", "smartphone app", "app", "ios", "android"],
      summary: "Native oder plattformnahe App fuer Smartphone-Bedienung, Benachrichtigungen oder mobile Nutzung.",
      properties: ["mobile Bedienung", "Push-/Geraetefunktionen moeglich", "Installationsaufwand"],
      provided_interfaces: ["Mobile UI", "optionale Push- oder Geraetefunktionen"],
      required_interfaces: ["Backend/API oder lokales Device-Interface", "Auth falls personenbezogen"],
      decision_hints: ["Nutzen, wenn Smartphone-Funktionen, Push, Kamera, Standort oder dauerhaft mobile Bedienung wichtig sind. Weglassen, wenn Browser UI reicht."],
    }),
    architectureComponent({
      component_id: "arch_component.desktop_app",
      name: "Desktop App",
      aliases: ["desktop app", "pc app", "computer app", "windows app", "mac app"],
      summary: "Installierbare Anwendung fuer PC-Arbeitsplaetze oder lokale Bedien-/Analyseaufgaben.",
      properties: ["starke lokale Integration", "gut fuer Arbeitsplaetze", "Installationsaufwand"],
      provided_interfaces: ["Desktop UI"],
      required_interfaces: ["Backend/API, lokale Dateien oder Device-Schnittstelle"],
      decision_hints: ["Nutzen, wenn PC-nahe Workflows, lokale Dateien oder spezielle Desktop-Integration gebraucht werden."],
    }),
    architectureComponent({
      component_id: "arch_component.backend_api",
      name: "Backend / API",
      aliases: ["backend", "api", "server", "rest", "websocket", "backend api"],
      summary: "Buendelt fachliche Services und stellt kontrollierte Schnittstellen fuer Browser, Mobile App, Desktop App oder Devices bereit.",
      properties: ["zentrale Logik", "kontrollierter Zugriff", "mehrere Clients"],
      provided_interfaces: ["REST API", "WebSocket", "Auth-/Datenzugriff"],
      required_interfaces: ["Persistenz falls Daten dauerhaft sind", "Hosting oder lokaler Server"],
      decision_hints: ["Nutzen, wenn zentrale Logik, Persistenz, Accounts, Remote-Zugriff oder mehrere Clients gebraucht werden."],
    }),
    architectureComponent({
      component_id: "arch_component.mqtt_broker",
      name: "MQTT Broker",
      aliases: ["mqtt", "mqtt broker", "broker", "topics", "telemetrie", "heartbeat"],
      summary: "Technischer Nachrichtenvermittler fuer lose gekoppelte Device-Kommunikation ueber Topics.",
      properties: ["asynchron", "leichtgewichtig", "Transportkanal statt fachliche Wahrheit"],
      provided_interfaces: ["MQTT Topics fuer Telemetrie, Heartbeats, Status und Befehle"],
      required_interfaces: ["MQTT Clients", "Topic-Konventionen", "Credentials oder lokale Entwicklungsfreigabe"],
      decision_hints: ["Nutzen, wenn Devices Status, Telemetrie oder Befehle entkoppelt austauschen sollen. Nicht fuer Firmware-Binaries oder dauerhafte fachliche Wahrheit verwenden."],
    }),
    architectureComponent({
      component_id: "arch_component.persistence",
      name: "Persistenz",
      aliases: ["persistenz", "datenbank", "sqlite", "database", "speicher", "historie"],
      summary: "Dauerhafte Speicherung fuer Projektdaten, Messwerte, Konfiguration oder Historie.",
      properties: ["dauerhafte Wahrheit", "Abfragefaehigkeit", "Auditierbarkeit"],
      provided_interfaces: ["SQL/SQLite-Datenmodell", "Lese-/Schreibzugriff ueber Service"],
      required_interfaces: ["Datenmodell", "Backup-/Migrationsstrategie"],
      decision_hints: ["Nutzen, wenn Daten nach Neustart erhalten bleiben muessen. In GerNetiX gilt: fachliche Wahrheit wird in SQL/SQLite persistiert."],
    }),
    architectureComponent({
      component_id: "arch_component.cloud_internet",
      name: "Cloud / Internet",
      aliases: ["cloud", "internet", "remote", "extern", "hosting", "weltweit"],
      summary: "Externer Betriebs- oder Zugriffspfad fuer weltweite Erreichbarkeit.",
      properties: ["Remote-Zugriff", "Betriebs-/Sicherheitsaufwand", "externe Abhaengigkeit"],
      provided_interfaces: ["oeffentliche URL oder Tunnel", "Hosting-Umgebung"],
      required_interfaces: ["Security-Konzept", "Auth", "Betriebsueberwachung"],
      decision_hints: ["Nutzen, wenn Zugriff ausserhalb des lokalen Netzes noetig ist."],
    }),
    architectureComponent({
      component_id: "arch_component.home_server",
      name: "HomeServer / lokaler Server",
      aliases: ["homeserver", "home server", "lokaler server", "raspberry", "lan"],
      summary: "Lokaler Serverbetrieb im eigenen Netz fuer Backend, Persistenz oder Automatisierung ohne Cloud-Zwang.",
      properties: ["lokaler Betrieb", "Daten bleiben im LAN", "eigene Betriebsverantwortung"],
      provided_interfaces: ["lokale Dienste", "LAN-Endpunkte"],
      required_interfaces: ["lokales Netzwerk", "Backup und Updates"],
      decision_hints: ["Nutzen, wenn lokale Kontrolle wichtiger ist als weltweite Cloud-Erreichbarkeit."],
    }),
  ];
}

function architectureComponent(input) {
  return {
    ...input,
    status: "active",
    source_scope: `start_architecture/components/${input.component_id.replace(/^arch_component\./, "")}`,
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

class InMemoryAiContextRepository {
  constructor(seed = {}) {
    this.grants = new Map((seed.grants || []).map((item) => [item.grant_id, clone(item)]));
    this.auditEvents = [...(seed.auditEvents || [])].map(clone);
    this.sources = new Map(mergeSources(defaultSources(), seed.sources || []).map((item) => [item.source_id, clone(item)]));
    this.promptFoundations = new Map(mergePromptFoundations(defaultPromptFoundations(), seed.promptFoundations || []).map((item) => [item.foundation_id, clone(item)]));
    this.architectureComponents = new Map(mergeById(defaultArchitectureComponents(), seed.architectureComponents || [], "component_id").map((item) => [item.component_id, clone(item)]));
    this.policy = clone(mergePolicy(defaultPolicy(), seed.policy));
  }

  saveGrant(grant) {
    this.grants.set(grant.grant_id, clone(grant));
    return clone(grant);
  }

  findGrant(grantId) {
    return clone(this.grants.get(grantId));
  }

  listGrants(filter = {}) {
    return Array.from(this.grants.values())
      .filter((grant) => matchesGrantFilter(grant, filter))
      .map(clone);
  }

  revokeGrant(grantId, revokedAt = nowIso()) {
    const grant = this.grants.get(grantId);
    if (!grant) return null;
    const next = { ...grant, revoked_at: revokedAt };
    this.grants.set(grantId, next);
    return clone(next);
  }

  savePolicy(policy) {
    this.policy = clone({ ...this.policy, ...policy, policy_id: "default", updated_at: nowIso() });
    return clone(this.policy);
  }

  getPolicy() {
    return clone(this.policy);
  }

  addAuditEvent(event) {
    this.auditEvents.push(clone(event));
    return clone(event);
  }

  listAuditEvents(filter = {}) {
    return this.auditEvents
      .filter((event) => matchesAuditFilter(event, filter))
      .map(clone);
  }

  saveSource(source) {
    this.sources.set(source.source_id, clone(source));
    return clone(source);
  }

  listSources(filter = {}) {
    return Array.from(this.sources.values())
      .filter((source) => matchesSourceFilter(source, filter))
      .map(clone);
  }

  savePromptFoundation(promptFoundation) {
    this.promptFoundations.set(promptFoundation.foundation_id, clone(promptFoundation));
    return clone(promptFoundation);
  }

  listPromptFoundations(filter = {}) {
    return Array.from(this.promptFoundations.values())
      .filter((item) => matchesPromptFoundationFilter(item, filter))
      .map(clone);
  }

  saveArchitectureComponent(component) {
    this.architectureComponents.set(component.component_id, clone(component));
    return clone(component);
  }

  listArchitectureComponents(filter = {}) {
    return Array.from(this.architectureComponents.values())
      .filter((item) => matchesArchitectureComponentFilter(item, filter))
      .map(clone);
  }
}

function mergeSources(defaultItems, seedItems) {
  const byId = new Map(defaultItems.map((item) => [item.source_id, item]));
  for (const item of seedItems || []) byId.set(item.source_id, item);
  return Array.from(byId.values());
}

function mergePromptFoundations(defaultItems, seedItems) {
  return mergeById(defaultItems, seedItems, "foundation_id");
}

function mergeById(defaultItems, seedItems, idField) {
  const byId = new Map(defaultItems.map((item) => [item[idField], item]));
  for (const item of seedItems || []) byId.set(item[idField], item);
  return Array.from(byId.values());
}

function mergePolicy(defaultItem, seedItem) {
  if (!seedItem) return defaultItem;
  return {
    ...defaultItem,
    ...seedItem,
    protected_source_types: Array.from(new Set([
      ...(defaultItem.protected_source_types || []),
      ...(seedItem.protected_source_types || []),
    ])),
  };
}

function matchesGrantFilter(grant, filter) {
  if (filter.account_id && grant.account_id !== filter.account_id) return false;
  if (filter.source_type && grant.source_type !== filter.source_type) return false;
  if (filter.purpose && grant.purpose !== filter.purpose) return false;
  if (filter.status === "active" && !isGrantActive(grant, new Date())) return false;
  return true;
}

function matchesAuditFilter(event, filter) {
  if (filter.account_id && event.account_id !== filter.account_id) return false;
  if (filter.access_decision && event.access_decision !== filter.access_decision) return false;
  if (filter.source_type && event.source_type !== filter.source_type) return false;
  return true;
}

function matchesSourceFilter(source, filter) {
  if (filter.source_type && source.source_type !== filter.source_type) return false;
  if (filter.status && source.status !== filter.status) return false;
  return true;
}

function matchesPromptFoundationFilter(item, filter) {
  if (filter.route_task && item.route_task !== filter.route_task) return false;
  if (filter.content_kind && item.content_kind !== filter.content_kind) return false;
  if (filter.status && item.status !== filter.status) return false;
  return true;
}

function matchesArchitectureComponentFilter(item, filter) {
  if (filter.status && item.status !== filter.status) return false;
  if (filter.component_id && item.component_id !== filter.component_id) return false;
  return true;
}

function isGrantActive(grant, at) {
  if (grant.revoked_at) return false;
  if (grant.valid_from && new Date(grant.valid_from).getTime() > at.getTime()) return false;
  if (grant.valid_until && new Date(grant.valid_until).getTime() <= at.getTime()) return false;
  return true;
}

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

module.exports = { InMemoryAiContextRepository, defaultPolicy, defaultSources, defaultPromptFoundations, defaultArchitectureComponents, isGrantActive };
