"use strict";

function createAccountRuntimeService({
  projectServerUserId,
  deviceManagementJson,
  loadProcessorBoards,
  mergeBoardFeatures,
  isUsbFlashDevice,
  defaultUploadPort,
  deviceBuildConfig,
  buildTargetLabel,
  hardwareShopJson,
  hardwareShopBaseUrl,
  getUserIdeState,
  ownedCapabilityIds,
  readJsonBody,
  requiredField,
  sendJson,
  aiUsageJson,
  aiUsageBaseUrl,
}) {
  async function loadUserIdeDevices(session) {
    const accountId = projectServerUserId(session);
    const response = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/devices`);
    return (response.items || []).map(decorateUserIdeDevice);
  }

  async function loadAccountBoardConfigurations(session) {
    const accountId = projectServerUserId(session);
    const response = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/board-configurations`);
    return response.items || [];
  }

  async function loadAvailableProcessorBoards(session) {
    const systemBoards = await loadProcessorBoards();
    const accountBoards = await loadAccountBoardConfigurations(session);
    return [
      ...systemBoards.map((board) => ({ ...board, configuration_scope: "gernetix", base_board_profile_id: board.hardware_item_id })),
      ...accountBoards.map((board) => accountBoardAsProcessorBoard(board, systemBoards)).filter(Boolean),
    ];
  }

  function accountBoardAsProcessorBoard(accountBoard, systemBoards) {
    const base = systemBoards.find((board) => [board.hardware_item_id, board.hardware_profile_id, board.id]
      .filter(Boolean).some((id) => String(id) === String(accountBoard.base_board_profile_id)));
    if (!base) return null;
    const selectionId = `account_board:${accountBoard.account_board_id}:v${accountBoard.version}`;
    return {
      ...base,
      hardware_item_id: selectionId,
      hardware_profile_id: selectionId,
      id: selectionId,
      title: `${accountBoard.name} \u00b7 Mein Board`,
      configuration_scope: "account",
      account_board_id: accountBoard.account_board_id,
      account_board_version: accountBoard.version,
      base_board_profile_id: accountBoard.base_board_profile_id,
      default_instance_configuration: {
        ...(base.default_instance_configuration || {}),
        board_features: mergeBoardFeatures(
          base.default_instance_configuration?.board_features,
          accountBoard.board_features,
        ),
      },
    };
  }

  function decorateUserIdeDevice(device) {
    return {
      device_id: device.device_id,
      account_device_id: device.account_device_id,
      display_name: device.display_name,
      node_name: device.node_name || "",
      hostname: device.hostname || device.node_name || "",
      hardware_profile_id: device.hardware_profile_id,
      hardware_class: device.hardware_class || device.instance_configuration?.role || "",
      technical_capability_ids: device.technical_capability_ids || [],
      instance_configuration: device.instance_configuration || {},
      authenticity_status: device.authenticity_status,
      connectivity_status: device.connectivity_status,
      last_seen_at: device.last_seen_at || "",
      firmware_version: device.app_version || device.runtime_version || device.firmware_version || "",
      battery_percent: device.battery_percent ?? device.instance_configuration?.battery_percent ?? null,
      ota_status: device.ota_status,
      usb_flash_supported: isUsbFlashDevice(device),
      upload_port: defaultUploadPort(device),
      build_config: deviceBuildConfig(device),
      build_target_label: buildTargetLabel(device),
      ownership_status: device.ownership_status,
      voice_ai_policy: device.voice_ai_policy || {
        enabled: false,
        age_band: "child_6_12",
        max_recording_seconds: 15,
        max_reply_seconds: 20,
        raw_audio_retention: "transient_only",
        transcript_retention: "disabled",
      },
      purchase_context_id: device.purchase_context_id || "",
      hardware_unit_id: device.instance_configuration?.hardware_unit_id || "",
    };
  }

  async function loadHardwareShopSummary(session) {
    const devices = await loadUserIdeDevices(session);
    const offers = await hardwareShopJson("/api/hardware-shop/offers");
    const projects = getUserIdeState().projectDefinitions;
    const recommendations = [];
    for (const project of projects) {
      const match = await hardwareShopJson("/api/hardware-shop/match", {
        method: "POST",
        body: {
          required_capability_ids: project.required_capability_ids,
          owned_capability_ids: ownedCapabilityIds(devices),
        },
      });
      recommendations.push({
        project_slug: project.slug,
        project_title: project.title,
        required_capability_ids: project.required_capability_ids,
        matches: match.items.slice(0, 3),
      });
    }
    return {
      base_url: hardwareShopBaseUrl,
      account_id: projectServerUserId(session),
      offers: offers.items,
      recommendations,
    };
  }

  async function handlePlatformFlashboxClaim(req, res, session) {
    try {
      const body = await readJsonBody(req);
      const accountId = projectServerUserId(session);
      const result = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(accountId)}/hardware-unit-claims`, {
        method: "POST",
        body: {
          claim_code: requiredField(body.claim_code || body.claimCode, "claim_code"),
          display_name: body.display_name || body.displayName || "GerNetiX Flashbox",
        },
      });
      sendJson(res, 201, {
        hardware_unit: result.hardware_unit,
        device: decorateUserIdeDevice(result.account_device),
      });
    } catch (error) {
      sendJson(res, error.status || 400, {
        error: error.code || "flashbox_claim_failed",
        message: error.message || "Flashbox konnte nicht inventarisiert werden.",
        details: error.payload || {},
      });
    }
  }

  async function handleHardwareShopOrder(req, res, session) {
    const body = await readJsonBody(req);
    const offerId = String(body.offer_id || "").trim();
    if (!offerId) {
      sendJson(res, 400, { error: "missing_offer_id", message: "offer_id fehlt." });
      return;
    }
    const cart = await hardwareShopJson("/api/hardware-shop/carts", {
      method: "POST",
      body: { account_id: projectServerUserId(session) },
    });
    await hardwareShopJson(`/api/hardware-shop/carts/${encodeURIComponent(cart.cart_id)}/items`, {
      method: "POST",
      body: { offer_id: offerId, quantity: Number(body.quantity || 1) },
    });
    const order = await hardwareShopJson("/api/hardware-shop/orders", {
      method: "POST",
      body: { cart_id: cart.cart_id, payment_status: "paid" },
    });
    const purchaseContext = await hardwareShopJson(`/api/hardware-shop/orders/${encodeURIComponent(order.order_id)}/purchase-context`);
    const deviceManagementPurchaseContext = await deviceManagementJson(`/api/device-management/accounts/${encodeURIComponent(projectServerUserId(session))}/purchase-contexts`, {
      method: "POST",
      body: { order_id: order.order_id, ...purchaseContext },
    });
    sendJson(res, 201, {
      order,
      purchase_context: purchaseContext,
      device_management_purchase_context: deviceManagementPurchaseContext,
    });
  }

  async function loadAiUsageSummary(session) {
    const accountId = projectServerUserId(session);
    try {
      const [credits, rating, dashboard, creditPackages] = await Promise.all([
        aiUsageJson(`/api/ai-usage/accounts/${encodeURIComponent(accountId)}/credits`),
        aiUsageJson(`/api/ai-usage/accounts/${encodeURIComponent(accountId)}/rating`),
        aiUsageJson("/api/ai-usage/admin/dashboard"),
        aiUsageJson("/api/ai-usage/credit-packages"),
      ]);
      return {
        base_url: aiUsageBaseUrl,
        available: true,
        credits,
        credit_packages: creditPackages.items || [],
        rating,
        usage_events: dashboard.summary,
        account_usage: (dashboard.by_account || []).find((item) => item.account_id === accountId) || null,
        model_summary: dashboard.by_model,
      };
    } catch (error) {
      return {
        base_url: aiUsageBaseUrl,
        available: false,
        credits: { account_id: accountId, available_credits: 0, consumed_credits: 0 },
        credit_packages: [],
        rating: { account_id: accountId, used_percent: 0, sources: [] },
        usage_events: {},
        account_usage: null,
        model_summary: [],
        error: error.message || "AI Usage Service ist nicht erreichbar.",
      };
    }
  }

  return {
    loadHardwareShopSummary,
    loadUserIdeDevices,
    loadAccountBoardConfigurations,
    loadAvailableProcessorBoards,
    decorateUserIdeDevice,
    handlePlatformFlashboxClaim,
    handleHardwareShopOrder,
    loadAiUsageSummary,
  };
}

module.exports = { createAccountRuntimeService };
