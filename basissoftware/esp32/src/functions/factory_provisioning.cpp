#include "basissoftware/factory_provisioning.h"

#if __has_include("basissoftware/generated_provisioning_payload.h")
#include "basissoftware/generated_provisioning_payload.h"
#define GERNETIX_HAS_FACTORY_PROVISIONING_PAYLOAD 1
#else
#define GERNETIX_HAS_FACTORY_PROVISIONING_PAYLOAD 0
#endif

#include <cstring>

#include "basissoftware/feedback.h"
#include "basissoftware/provisioning_config.h"

namespace {
constexpr const char *TAG = "factoryProvisioning";
}

esp_err_t applyFactoryProvisioningIfAvailable() {
#if GERNETIX_HAS_FACTORY_PROVISIONING_PAYLOAD
  const ProvisioningConfig existing = loadProvisioningConfig();
  if (existing.provisioned) {
    feedbackInfo(TAG, "Factory provisioning skipped because device is already provisioned");
    return ESP_OK;
  }

  if (std::strlen(GERNETIX_FACTORY_PROVISIONING_PAYLOAD) == 0) {
    feedbackWarning(TAG, "Factory provisioning payload is empty");
    return ESP_ERR_INVALID_ARG;
  }

  const esp_err_t status = saveProvisioningPayload(
      GERNETIX_FACTORY_PROVISIONING_PAYLOAD,
      std::strlen(GERNETIX_FACTORY_PROVISIONING_PAYLOAD));
  if (status == ESP_OK) {
    feedbackInfo(TAG, "Factory provisioning payload imported from USB flash image");
  }
  return status;
#else
  return ESP_OK;
#endif
}
