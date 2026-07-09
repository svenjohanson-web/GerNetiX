function createAccountTransparencyFactory({
  aiUsageJson,
  demoEmail,
  demoUsername,
  deviceManagementJson,
  hardwareShopJson,
  projectServerJson,
  projectServerUserId,
}) {
  return async function createAccountTransparency(session, options = {}) {
    const accountId = projectServerUserId(session);
    const generatedAt = new Date().toISOString();
    const [
      projects,
      feedback,
      devices,
      purchaseContexts,
      auditEvents,
      credits,
      usageEvents,
      hardwareOffers,
    ] = await Promise.all([
      transparencySection("project-server.projects", () => projectServerJson(`/api/projects?user_id=${encodeURIComponent(accountId)}`)),
      transparencySection("project-server.feedback", () => projectServerJson(`/api/learning-feedback?user_id=${encodeURIComponent(accountId)}`)),
      transparencySection("device-management.devices", () => deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`)),
      transparencySection("device-management.purchase-contexts", () => deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/purchase-contexts`)),
      transparencySection("device-management.audit-events", () => deviceManagementJson(`/api/device-management/customer-data-access/audit-events?accountId=${encodeURIComponent(accountId)}`)),
      transparencySection("ai-usage.credits", () => aiUsageJson(`/api/ai-usage/accounts/${encodeURIComponent(accountId)}/credits`)),
      transparencySection("ai-usage.events", () => aiUsageJson(`/api/ai-usage/events?account_id=${encodeURIComponent(accountId)}`)),
      transparencySection("hardware-shop.offers", () => hardwareShopJson("/api/hardware-shop/offers")),
    ]);
    const ownDevices = sectionItems(devices).map(sanitizeDevice);

    return {
      generated_at: generatedAt,
      refresh_requested: Boolean(options.refresh),
      identity: {
        user_id: accountId,
        username: session.account.username || demoUsername,
        account_status: "active",
        sources: [sourceRef("identity-server.session", "authenticated_session")],
      },
      contact_data: {
        email: session.account.email || demoEmail,
        email_verified: Boolean(session.account.email_verified ?? true),
        sources: [sourceRef("identity-server.session", "own_account_contact_data")],
      },
      login_providers: [{
        provider: "local_password",
        status: "active",
        exposed_fields: ["provider", "status"],
        redacted_fields: ["password_hash", "reset_tokens", "session_tokens"],
        source: sourceRef("identity-server.auth", "credential_material_is_never_exposed"),
      }],
      plans_subscriptions_and_purchases: {
        plan: "Premium Demo",
        subscriptions: [],
        purchase_contexts: sectionItems(purchaseContexts).map(sanitizePurchaseContext),
        sources: [sourceRef("identity-server.demo-plan", "demo_plan_assignment"), sourceStatus(purchaseContexts)],
      },
      product_offerings: {
        hardware_offers: sectionItems(hardwareOffers).map((offer) => ({
          offer_id: offer.offer_id,
          title: offer.title,
          hardware_profile_id: offer.hardware_profile_id,
          capability_ids: offer.capability_ids || [],
        })),
        sources: [sourceStatus(hardwareOffers)],
      },
      grants_overrides_and_capabilities: {
        grants: [
          grant("ide_flash_usb", "Premium Demo", "User IDE darf USB-Builds vorbereiten."),
          grant("ide_flash_ota", "Premium Demo", "User IDE darf OTA-faehige Zielgeraete verwenden."),
          grant("cloud_flash", "Device Ownership", "Cloud Flash ist nur fuer eigene Devices vorgesehen."),
          grant("system_capability.ai_assistant", "AI Usage Credits", "KI-Aufrufe werden per Preflight gegen Credits geprueft."),
        ],
        overrides: [],
        sources: [sourceRef("identity-server.capability-map", "derived_from_demo_plan_and_user_ownership")],
      },
      devices_and_support: {
        devices: ownDevices,
        purchase_contexts: sectionItems(purchaseContexts).map(sanitizePurchaseContext),
        sources: [sourceStatus(devices), sourceStatus(purchaseContexts)],
      },
      learning_profile: {
        projects: sectionItems(projects).map(sanitizeProject),
        sources: [sourceStatus(projects)],
      },
      feedback: {
        items: sectionItems(feedback).map(sanitizeFeedback),
        sources: [sourceStatus(feedback)],
      },
      ai_credits_and_usage: {
        credits: stripProviderCosts(credits.payload || {}),
        events: sectionItems(usageEvents).map(stripProviderCosts),
        sources: [sourceStatus(credits), sourceStatus(usageEvents)],
      },
      consents_and_customer_data_access: {
        audit_events: sectionItems(auditEvents).map(stripProviderCosts),
        note: "Consent-Details werden nur ueber eigene Consent-IDs abgerufen; Secrets und interne Kosten bleiben redigiert.",
        sources: [sourceStatus(auditEvents)],
      },
      sources_and_last_updated: [
        sourceStatus(projects),
        sourceStatus(feedback),
        sourceStatus(devices),
        sourceStatus(purchaseContexts),
        sourceStatus(auditEvents),
        sourceStatus(credits),
        sourceStatus(usageEvents),
        sourceStatus(hardwareOffers),
      ],
    };
  };
}

async function transparencySection(source, loader) {
  try {
    return { source, available: true, refreshed_at: new Date().toISOString(), payload: await loader() };
  } catch (error) {
    return {
      source,
      available: false,
      refreshed_at: new Date().toISOString(),
      error: error.status ? `${error.status}:${error.message}` : error.message,
      payload: { items: [] },
    };
  }
}

function sectionItems(section) {
  if (!section || !section.payload) return [];
  if (Array.isArray(section.payload.items)) return section.payload.items;
  if (Array.isArray(section.payload)) return section.payload;
  return [];
}

function sourceStatus(section) {
  return {
    source: section.source,
    available: section.available,
    refreshed_at: section.refreshed_at,
    reason: section.available ? "own_data_query" : section.error,
  };
}

function sourceRef(source, reason) {
  return { source, available: true, refreshed_at: new Date().toISOString(), reason };
}

function grant(capability_id, source, reason) {
  return { capability_id, source, reason };
}

function sanitizeDevice(device) {
  return {
    account_device_id: device.account_device_id,
    device_id: device.device_id,
    display_name: device.display_name,
    hardware_profile_id: device.hardware_profile_id,
    technical_capability_ids: device.technical_capability_ids || [],
    board_short_name: device.board_short_name || "",
    node_name: device.node_name || "",
    instance_configuration: device.instance_configuration || {},
    authenticity_status: device.authenticity_status,
    connectivity_status: device.connectivity_status,
    ota_status: device.ota_status,
    ownership_status: device.ownership_status,
    purchase_context_id: device.purchase_context_id || "",
  };
}

function sanitizePurchaseContext(context) {
  return {
    purchase_context_id: context.purchase_context_id,
    order_id: context.order_id,
    account_id: context.account_id,
    source: context.source,
    support_level: context.support_level,
    hardware_profile_id: context.hardware_profile_id,
    valid_from: context.valid_from,
    valid_until: context.valid_until,
  };
}

function sanitizeProject(project) {
  return {
    project_id: project.project_id,
    user_id: project.user_id,
    title: project.title,
    description: project.description,
    learning_project_id: project.learning_project_id,
    hardware_profile_id: project.hardware_profile_id,
    device_id: project.device_id,
    status: project.status,
    source_count: project.source_count,
    build_count: project.build_count,
    updated_at: project.updated_at,
  };
}

function sanitizeFeedback(feedback) {
  return {
    feedback_id: feedback.feedback_id,
    user_id: feedback.user_id,
    project_id: feedback.project_id,
    rating: feedback.rating,
    comment: feedback.comment,
    has_contact_consent: Boolean(feedback.has_contact_consent),
    created_at: feedback.created_at,
  };
}

function stripProviderCosts(value) {
  if (Array.isArray(value)) return value.map(stripProviderCosts);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "estimated_provider_cost" && key !== "provider_cost")
      .map(([key, entry]) => [key, stripProviderCosts(entry)]),
  );
}

module.exports = {
  createAccountTransparencyFactory,
};
