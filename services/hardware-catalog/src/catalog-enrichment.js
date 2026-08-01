"use strict";

const ADDITIVELY_ENRICHED_ITEM_IDS = new Set([
  "hardware.processor_board.waveshare_esp32_s3_cam_ov3660",
]);
const WAVESHARE_CAMERA_ITEM_ID = "hardware.processor_board.waveshare_esp32_s3_cam_ov3660";
const OBSOLETE_WAVESHARE_EXPANDER_ROLES = new Set([
  "camera_power_down",
  "backlight",
  "audio_amplifier_enable",
  "tf_card_detect",
]);

function enrichKnownHardwareItem(item, seededItem) {
  const enriched = clone(item);
  if (!enriched || !seededItem
    || enriched.hardware_item_id !== seededItem.hardware_item_id
    || !isAdditivelyEnrichedHardwareItem(enriched.hardware_item_id)) {
    return enriched;
  }

  mergeMissingProperties(enriched, seededItem);
  enriched.capability_ids = union(enriched.capability_ids, seededItem.capability_ids);

  const enrichedRoles = enriched.default_instance_configuration?.io_expander?.roles;
  const seededRoles = seededItem.default_instance_configuration?.io_expander?.roles;
  if (enrichedRoles || seededRoles) {
    enriched.default_instance_configuration.io_expander.roles = union(enrichedRoles, seededRoles)
      .filter((role) => !OBSOLETE_WAVESHARE_EXPANDER_ROLES.has(role));
  }
  if (enriched.hardware_item_id === WAVESHARE_CAMERA_ITEM_ID) {
    // Die bisherige Seed-Belegung ordnete Kamera-Power irrtuemlich EXIO3 zu.
    // Waveshares Referenztreiber aktiviert die integrierte Kamera ueber IO6.
    // Diese Herstellerbelegung ist keine additive Nutzeranpassung und ersetzt
    // deshalb auch in einem bereits persistierten System-Katalog die Altwerte.
    enriched.default_instance_configuration.io_expander.lines = clone(
      seededItem.default_instance_configuration.io_expander.lines,
    );
  }
  return enriched;
}

function isAdditivelyEnrichedHardwareItem(itemId) {
  return ADDITIVELY_ENRICHED_ITEM_IDS.has(itemId);
}

function mergeMissingProperties(target, source) {
  if (!isPlainObject(target) || !isPlainObject(source)) return;
  for (const [key, value] of Object.entries(source)) {
    if (!Object.prototype.hasOwnProperty.call(target, key)) {
      target[key] = clone(value);
    } else if (isPlainObject(target[key]) && isPlainObject(value)) {
      mergeMissingProperties(target[key], value);
    }
  }
}

function union(current = [], additions = []) {
  return Array.from(new Set([...(current || []), ...(additions || [])]));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

module.exports = { enrichKnownHardwareItem, isAdditivelyEnrichedHardwareItem };
