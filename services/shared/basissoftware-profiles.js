const PROFILE_DEFINITIONS = Object.freeze({
  full: Object.freeze({
    profile_id: "basissoftware.profile.esp32.full",
    class: "full",
    firmware_basis_variant: "full",
    partition_profile_id: "partition.profile.esp32.ota_ab",
    update_strategy: "ota_ab_rollback",
    supported_update_modes: Object.freeze(["usb", "ota"]),
  }),
  medium: Object.freeze({
    profile_id: "basissoftware.profile.esp32.medium",
    class: "medium",
    firmware_basis_variant: "medium",
    partition_profile_id: "partition.profile.esp32.bootstrap_single_slot",
    update_strategy: "bootstrap_retry",
    supported_update_modes: Object.freeze(["usb", "ota"]),
  }),
  low: Object.freeze({
    profile_id: "basissoftware.profile.esp32.low",
    class: "low",
    firmware_basis_variant: "low",
    partition_profile_id: "partition.profile.esp32.single_app_usb",
    update_strategy: "usb_only",
    supported_update_modes: Object.freeze(["usb"]),
  }),
});

function normalizeBasissoftwareProfile(input) {
  const requested = typeof input === "string" ? input : input?.class || input?.profile_id || "";
  const profileClass = Object.values(PROFILE_DEFINITIONS)
    .find((profile) => profile.class === requested || profile.profile_id === requested)?.class;
  if (!profileClass) return null;
  return clone(PROFILE_DEFINITIONS[profileClass]);
}

function profileChangeRequiresUsb(current, next) {
  const currentProfile = normalizeBasissoftwareProfile(current);
  const nextProfile = normalizeBasissoftwareProfile(next);
  if (!currentProfile || !nextProfile) return true;
  return currentProfile.partition_profile_id !== nextProfile.partition_profile_id;
}

function applyProfileCapabilities(capabilities = [], profileInput) {
  const profile = normalizeBasissoftwareProfile(profileInput);
  const normalized = new Set((capabilities || []).map((item) => String(item).replace(/^capability\./, "")));
  if (profile?.supported_update_modes.includes("ota")) normalized.add("ota");
  else normalized.delete("ota");
  return Array.from(normalized);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  PROFILE_DEFINITIONS,
  applyProfileCapabilities,
  normalizeBasissoftwareProfile,
  profileChangeRequiresUsb,
};
