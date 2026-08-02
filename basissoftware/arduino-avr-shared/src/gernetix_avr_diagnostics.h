#pragma once

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
  const char *runtime_name;
  uint32_t (*uptime_ms)(void);
  uint8_t (*serial_available)(void);
  int16_t (*serial_read)(void);
  void (*serial_write)(const char *text);
} gernetix_avr_diagnostics_config_t;

void gernetix_avr_diagnostics_init(const gernetix_avr_diagnostics_config_t *config);
void gernetix_avr_diagnostics_observe_loop(uint32_t duration_us);
void gernetix_avr_diagnostics_poll(void);

#ifdef __cplusplus
}
#endif
