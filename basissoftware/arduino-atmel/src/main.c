#include <avr/io.h>
#include "user/user_app.h"

int main(void) {
  user_setup();

  while (1) {
    user_loop();
  }
}
