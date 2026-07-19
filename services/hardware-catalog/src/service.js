const crypto = require("node:crypto");
const { HardwareCatalogError } = require("./errors");

class HardwareCatalogService {
  constructor(options) {
    this.repository = options.repository;
  }

  listCapabilities() {
    return this.repository.listCapabilities();
  }

  getCapability(capabilityId) {
    const capability = this.repository.findCapability(capabilityId);
    if (!capability) throw new HardwareCatalogError("capability_not_found", "TechnicalCapability wurde nicht gefunden.", 404);
    return capability;
  }

  upsertCapability(input = {}) {
    const capability = {
      capability_id: input.capability_id || input.id || required(input.capabilityId, "capability_id"),
      title: required(input.title, "title"),
      owner_domain: input.owner_domain || "Hardware",
      status: input.status || "active",
      summary: input.summary || "",
    };
    return this.repository.saveCapability(capability);
  }

  listHardwareItems(query = {}) {
    return this.repository.listHardwareItems({
      item_type: query.item_type || query.itemType || "",
      status: query.status || "active",
    });
  }

  getHardwareItem(itemId) {
    const item = this.repository.findHardwareItem(itemId);
    if (!item) throw new HardwareCatalogError("hardware_item_not_found", "HardwareItem wurde nicht gefunden.", 404);
    return item;
  }

  listProcessorBoards() {
    return this.listHardwareItems({ item_type: "processor_board", status: "active" })
      .filter((item) => !deprecatedProcessorBoardIds().has(item.hardware_item_id));
  }

  listSensors() {
    return this.listHardwareItems({ item_type: "sensor", status: "active" });
  }

  listBoardFeatureOptions() {
    return this.listHardwareItems({ item_type: "board_feature_option", status: "active" });
  }

  upsertHardwareItem(input = {}) {
    const capabilityIds = normalizeList(input.capability_ids || input.capabilities);
    for (const capabilityId of capabilityIds) this.getCapability(capabilityId);
    const item = {
      hardware_item_id: input.hardware_item_id || input.id || createId("hardware"),
      sku: required(input.sku, "sku"),
      item_type: input.item_type || "module",
      title: required(input.title, "title"),
      summary: input.summary || "",
      processor_family: input.processor_family || "",
      mcu_variant: input.mcu_variant || "",
      module_name: input.module_name || "",
      module_memory_variant: input.module_memory_variant || "",
      firmware_build_target_id: input.firmware_build_target_id || "",
      vendor: input.vendor || "",
      form_factor: input.form_factor || "",
      sensor_type_id: input.sensor_type_id || "",
      measurement_kinds: normalizeList(input.measurement_kinds),
      signal_type: input.signal_type || "",
      capability_ids: capabilityIds,
      identification_methods: normalizeList(input.identification_methods || input.identificationMethods),
      support_policy: input.support_policy || "community_usable_no_gernetix_hardware_entitlement",
      provisioning_profile_id: input.provisioning_profile_id || "",
      basissoftware_profile_id: input.basissoftware_profile_id || "",
      factory_firmware_artifact: input.factory_firmware_artifact || null,
      min_basissoftware_version: input.min_basissoftware_version || "",
      pin_profile: input.pin_profile && typeof input.pin_profile === "object" ? input.pin_profile : {},
      peripheral_profile: input.peripheral_profile && typeof input.peripheral_profile === "object" ? input.peripheral_profile : {},
      default_instance_configuration: input.default_instance_configuration || {},
      feature_id: input.feature_id || "",
      hardware_options: normalizeOptions(input.hardware_options),
      driver_options: normalizeOptions(input.driver_options),
      connection_options: normalizeOptions(input.connection_options),
      value_options: normalizeOptions(input.value_options),
      datasheet_hint: input.datasheet_hint || "",
      verification_status: input.verification_status || "unverified",
      evidence: input.evidence && typeof input.evidence === "object" ? input.evidence : {},
      status: input.status || "active",
    };
    return this.repository.saveHardwareItem(item);
  }
}

function deprecatedProcessorBoardIds() {
  return new Set([
    "hardware.processor_board.esp32_devkit",
    "hardware.processor_board.esp_wroom32",
    "hardware.processor_board.esp_wroom32_display",
    "hardware.processor_board.arduino_nano_atmega328p",
  ]);
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizeOptions(value) {
  return Array.isArray(value)
    ? value.filter((item) => item && item.id && item.title).map((item) => ({ id: String(item.id), title: String(item.title) }))
    : [];
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new HardwareCatalogError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  return normalized;
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = { HardwareCatalogService };
