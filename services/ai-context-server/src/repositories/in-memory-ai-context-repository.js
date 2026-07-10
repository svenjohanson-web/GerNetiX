function defaultPolicy() {
  return {
    policy_id: "default",
    deny_without_grant: true,
    require_explicit_source_scope: true,
    allow_external_provider_customer_data: false,
    default_max_context_items: 12,
    protected_source_types: ["customer_data", "project_files", "graph_database", "device_data", "hardware_catalog", "ai_prompt"],
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
      "Wenn noch keine Arbeitsweise fuer den Architektur-Dialog erkennbar ist, frage zuerst lesbar: `Du hast zunaechst die Wahl, ob du mit einer maximalen Architektur startest und Komponenten entfernst, die du nicht benoetigst, oder mit einer leeren Architektur. Wie moechtest du vorgehen? Antworte einfach mit max oder leer.`",
      "Wenn die letzte Nutzerantwort exakt `max`, `maximal` oder `maximale architektur` lautet, behandle sie ausschliesslich als Auswahl der maximalen Architektur-Arbeitsweise. Interpretiere `max` niemals als Namen, Begruessung oder unklare Frage.",
      "Wenn die letzte Nutzerantwort exakt `leer`, `leere architektur` oder `empty` lautet, behandle sie ausschliesslich als Auswahl der leeren Architektur-Arbeitsweise.",
      "Wenn der Nutzer `max` waehlt, kennst du den maximalen GerNetiX-Loesungsraum im Hintergrund und reduzierst ihn anhand der Nutzeraussage. Erwaehne deaktivierte Kandidaten nur knapp als Optionen, zeige sie aber nicht im PlantUML-Diagramm.",
      "Wenn der Nutzer `leer` waehlt, aktivierst du nur Strukturelemente, die der Nutzer nennt oder spaeter bestaetigt.",
      "Nutze fuer Komponentenbedeutung, Eigenschaften, Schnittstellen, Daten, Beziehungen und Systemverhalten den freigegebenen AI Context; erfinde diese Grundlagen nicht aus Internet- oder Weltwissen.",
      "Das generische Entwicklungsprojekt-Metamodell lautet: Projekte besitzen Architektur-Sichten und Komponenten. Architektur-Sichten sind statische Architektur, Informationsfluss und Systemverhalten. Komponenten besitzen Eigenschaften, provided/required Schnittstellen, Behavior, Daten und Beziehungen.",
      "Systemverhalten beschreibt komponentenuebergreifende Ablaeufe, Zustaende, Regeln, Ereignisse, Fehlerfaelle und Reaktionen. Bestaetigtes Systemverhalten kann in Komponentenverhalten, Schnittstellenanforderungen, Datenfluesse, Code und Konfiguration dekomponiert werden.",
      "Wenn der Nutzer bewusst einen Minimalumfang vorgibt, z. B. nur eine Struktur, nur ein ESP32, nur ein Port oder ohne Backend/Persistenz, akzeptiere das als ausreichende Vorgabe und liefere direkt eine minimale Struktur statt weitere Klaerungsfragen zu stellen.",
      "Antworte knapp und direkt. Liefere nur das, was der Nutzer angefragt hat; liste nicht auf, was nicht benoetigt wird.",
      "Bei eindeutigem ESP32-only-Auftrag: antworte maximal mit `ESP32.` und erfinde keine Nutzer-, Anforderungs-, Backend- oder Persistenzknoten.",
      "PlantUML-Strukturdiagramme enthalten nur technische Strukturelemente. Actor, Anforderungen, Projektidee und Notizen gehoeren nicht hinein, ausser ein Actor nutzt explizit ein technisches Interface.",
      "Wenn ein ESP32 oder anderes Strukturelement Messdaten ueber einen Webserver fuer Nutzer bereitstellt, wird der Zugriff als Actor -> Browser -> Webserver -> Strukturelement modelliert.",
      "Klaere insbesondere: Projektziel, Nutzer, lokale Messung, lokale Regelstrecke, mehrere Geraete, Datenspeicherung, Bedienoberflaeche, lokaler oder weltweiter Zugriff, Computer, Handy, Browser, Backend, Datenschutz, Offline-Verhalten und Betriebsmodell.",
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

class InMemoryAiContextRepository {
  constructor(seed = {}) {
    this.grants = new Map((seed.grants || []).map((item) => [item.grant_id, clone(item)]));
    this.auditEvents = [...(seed.auditEvents || [])].map(clone);
    this.sources = new Map(mergeSources(defaultSources(), seed.sources || []).map((item) => [item.source_id, clone(item)]));
    this.promptFoundations = new Map(mergePromptFoundations(defaultPromptFoundations(), seed.promptFoundations || []).map((item) => [item.foundation_id, clone(item)]));
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
}

function mergeSources(defaultItems, seedItems) {
  const byId = new Map(defaultItems.map((item) => [item.source_id, item]));
  for (const item of seedItems || []) byId.set(item.source_id, item);
  return Array.from(byId.values());
}

function mergePromptFoundations(defaultItems, seedItems) {
  const byId = new Map(defaultItems.map((item) => [item.foundation_id, item]));
  for (const item of seedItems || []) byId.set(item.foundation_id, item);
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

module.exports = { InMemoryAiContextRepository, defaultPolicy, defaultSources, defaultPromptFoundations, isGrantActive };
