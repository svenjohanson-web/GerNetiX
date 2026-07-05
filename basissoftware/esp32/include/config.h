#pragma once

#if __has_include("user/wifi_config.h")
  #include "user/wifi_config.h"
#else
  #include "user/wifi_config.example.h"
#endif

#if __has_include("user/hw_pwm_config.h")
  #include "user/hw_pwm_config.h"
#else
  #include "user/hw_pwm_config.example.h"
#endif
