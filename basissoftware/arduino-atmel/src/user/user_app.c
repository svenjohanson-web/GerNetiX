#include <avr/io.h>
#include <util/delay.h>
#include "user/user_app.h"

void user_setup(void) {
  DDRB |= _BV(DDB5);
}

void user_loop(void) {
  PORTB ^= _BV(PORTB5);
  _delay_ms(100);
}
