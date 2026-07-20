#include "gernetix_flashbox_write_state_machine.h"

#include "gernetix_flashbox_config.h"

namespace {

FlashboxWritePlan blocked(const String& state, const String& route, const String& error) {
  return FlashboxWritePlan{ state, route, error, false };
}

}  // namespace

FlashboxWritePlan flashboxPlanWriteAfterArtifactVerified(
  const String& manifestType,
  bool signatureVerified,
  bool hashVerified) {
  if (!signatureVerified) {
    return blocked(
      "write_preflight_blocked",
      "none",
      "write_requires_verified_manifest_signature");
  }

  if (!hashVerified) {
    return blocked(
      "write_preflight_blocked",
      "none",
      "write_requires_verified_artifact_hash");
  }

  if (manifestType == GERNETIX_FLASHBOX_MANIFEST_TYPE_SELF_UPDATE) {
    return blocked(
      "self_update_dual_slot_preflight_blocked",
      "flashbox_self_update_dual_slot",
      "self_update_writer_not_implemented");
  }

  if (manifestType == GERNETIX_FLASHBOX_MANIFEST_TYPE_INITIAL_BOOTSTRAP ||
      manifestType == GERNETIX_FLASHBOX_MANIFEST_TYPE_KNOWN_DEVICE_RECOVERY ||
      manifestType == GERNETIX_FLASHBOX_MANIFEST_TYPE_BASISSOFTWARE_REFLASH ||
      manifestType == GERNETIX_FLASHBOX_MANIFEST_TYPE_PROJECT_FIRMWARE) {
    return blocked(
      "target_usb_otg_flash_preflight_blocked",
      "target_device_usb_otg_flash",
      "usb_otg_writer_not_implemented");
  }

  return blocked(
    "write_preflight_blocked",
    "none",
    "unsupported_manifest_type_for_write");
}
