// Kept behind a C-compatible header, but built as C++ so PlatformIO links it
// consistently with the Arduino entry point in the mixed Arduino/ESP-IDF build.
#include "gernetix_flashbox_ble.h"

#include <string.h>

#include "esp_nimble_hci.h"
#include "host/ble_gap.h"
#include "host/ble_gatt.h"
#include "host/ble_hs.h"
#include "host/util/util.h"
#include "nimble/nimble_port.h"
#include "nimble/nimble_port_freertos.h"
#include "services/gap/ble_svc_gap.h"
#include "services/gatt/ble_svc_gatt.h"

#define FLASHBOX_BLE_STATUS_MAX_BYTES 384

static uint8_t own_addr_type;
static char status_json[FLASHBOX_BLE_STATUS_MAX_BYTES] = "{\"state\":\"starting\"}";

static const ble_uuid128_t flashbox_service_uuid = BLE_UUID128_INIT(
  0x01, 0xea, 0x04, 0xa0, 0x79, 0x64, 0xf6, 0xbb,
  0x89, 0x4a, 0xdf, 0x62, 0x20, 0x4b, 0xa4, 0xbc);
static const ble_uuid128_t flashbox_status_uuid = BLE_UUID128_INIT(
  0x01, 0xea, 0x04, 0xa0, 0x79, 0x64, 0xf6, 0xbb,
  0x89, 0x4a, 0xdf, 0x62, 0x21, 0x4b, 0xa4, 0xbc);
static const ble_uuid128_t flashbox_capabilities_uuid = BLE_UUID128_INIT(
  0x01, 0xea, 0x04, 0xa0, 0x79, 0x64, 0xf6, 0xbb,
  0x89, 0x4a, 0xdf, 0x62, 0x22, 0x4b, 0xa4, 0xbc);

static int flashbox_ble_gap_event(struct ble_gap_event* event, void* arg);

static int flashbox_ble_access(uint16_t conn_handle, uint16_t attr_handle,
                               struct ble_gatt_access_ctxt* ctxt, void* arg) {
  (void)conn_handle;
  (void)attr_handle;
  (void)arg;
  if (ctxt->op != BLE_GATT_ACCESS_OP_READ_CHR) return BLE_ATT_ERR_UNLIKELY;
  if (ble_uuid_cmp(ctxt->chr->uuid, &flashbox_status_uuid.u) == 0) {
    return os_mbuf_append(ctxt->om, status_json, strlen(status_json)) == 0 ? 0 : BLE_ATT_ERR_INSUFFICIENT_RES;
  }
  static const char capabilities[] =
    "{\"transport\":\"nimble_gatt\",\"scope\":\"discovery_and_status\","
    "\"wifi_configuration\":\"local_web_portal\",\"flash_transfer\":\"planned_paired_transport\"}";
  return os_mbuf_append(ctxt->om, capabilities, sizeof(capabilities) - 1) == 0 ? 0 : BLE_ATT_ERR_INSUFFICIENT_RES;
}

static const struct ble_gatt_svc_def flashbox_ble_services[] = {
  {
    .type = BLE_GATT_SVC_TYPE_PRIMARY,
    .uuid = &flashbox_service_uuid.u,
    .characteristics = (struct ble_gatt_chr_def[]) {
      {
        .uuid = &flashbox_status_uuid.u,
        .access_cb = flashbox_ble_access,
        .flags = BLE_GATT_CHR_F_READ,
      },
      {
        .uuid = &flashbox_capabilities_uuid.u,
        .access_cb = flashbox_ble_access,
        .flags = BLE_GATT_CHR_F_READ,
      },
      {0},
    },
  },
  {0},
};

static void flashbox_ble_advertise(void) {
  struct ble_hs_adv_fields fields = {0};
  fields.flags = BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP;
  fields.uuids128 = &flashbox_service_uuid;
  fields.num_uuids128 = 1;
  fields.uuids128_is_complete = 1;
  if (ble_gap_adv_set_fields(&fields) != 0) return;

  struct ble_hs_adv_fields response = {0};
  const char* name = ble_svc_gap_device_name();
  response.name = (uint8_t*)name;
  response.name_len = strlen(name);
  response.name_is_complete = 1;
  if (ble_gap_adv_rsp_set_fields(&response) != 0) return;

  struct ble_gap_adv_params params = {0};
  params.conn_mode = BLE_GAP_CONN_MODE_UND;
  params.disc_mode = BLE_GAP_DISC_MODE_GEN;
  ble_gap_adv_start(own_addr_type, NULL, BLE_HS_FOREVER, &params, flashbox_ble_gap_event, NULL);
}

static int flashbox_ble_gap_event(struct ble_gap_event* event, void* arg) {
  (void)arg;
  if (event->type == BLE_GAP_EVENT_DISCONNECT) flashbox_ble_advertise();
  return 0;
}

static void flashbox_ble_on_sync(void) {
  if (ble_hs_id_infer_auto(0, &own_addr_type) == 0) flashbox_ble_advertise();
}

static void flashbox_ble_host_task(void* param) {
  (void)param;
  nimble_port_run();
  nimble_port_freertos_deinit();
}

void flashboxBleUpdateStatus(const char* value) {
  if (value == NULL) return;
  strncpy(status_json, value, sizeof(status_json) - 1);
  status_json[sizeof(status_json) - 1] = '\0';
}

void flashboxBleBegin(const char* device_name) {
  if (esp_nimble_hci_and_controller_init() != 0) return;
  nimble_port_init();
  ble_svc_gap_init();
  ble_svc_gatt_init();
  ble_hs_cfg.sync_cb = flashbox_ble_on_sync;
  ble_gatts_count_cfg(flashbox_ble_services);
  ble_gatts_add_svcs(flashbox_ble_services);
  ble_svc_gap_device_name_set(device_name);
  nimble_port_freertos_init(flashbox_ble_host_task);
}
