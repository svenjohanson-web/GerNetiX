#include <avr/io.h>
#include <stdint.h>
#include "gernetix_avr_diagnostics.h"
#include "user/user_app.h"

static uint8_t serial_available(void) {
  return (UCSR0A & _BV(RXC0)) != 0;
}

static int16_t serial_read(void) {
  return serial_available() ? UDR0 : -1;
}

static void serial_write(const char *text) {
  while (*text != '\0') {
    while ((UCSR0A & _BV(UDRE0)) == 0) {}
    UDR0 = *text++;
  }
}

static void serial_init(void) {
  const uint16_t divider = (uint16_t)(F_CPU / 16UL / 9600UL - 1UL);
  UBRR0H = (uint8_t)(divider >> 8);
  UBRR0L = (uint8_t)divider;
  UCSR0B = _BV(RXEN0) | _BV(TXEN0);
  UCSR0C = _BV(UCSZ01) | _BV(UCSZ00);
}

int main(void) {
  serial_init();
  const gernetix_avr_diagnostics_config_t diagnostics = {
    "avr-libc",
    0,
    serial_available,
    serial_read,
    serial_write,
  };
  gernetix_avr_diagnostics_init(&diagnostics);
  user_setup();

  while (1) {
    gernetix_avr_diagnostics_poll();
    user_loop();
    gernetix_avr_diagnostics_observe_loop(0);
  }
}
