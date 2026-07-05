#include <Arduino.h>
#include "user_app.h"
#include "config.h"

static uint32_t lastDutyChangeAt = 0;
static uint8_t dutyStep = 0;

void setupUserApp() {
  ledcSetup(GERNETIX_USER_PWM_CHANNEL, GERNETIX_USER_PWM_FREQUENCY_HZ, GERNETIX_USER_PWM_RESOLUTION_BITS);
  ledcAttachPin(GERNETIX_USER_PWM_PIN, GERNETIX_USER_PWM_CHANNEL);
  ledcWrite(GERNETIX_USER_PWM_CHANNEL, GERNETIX_USER_PWM_DUTY_MIN);
}

void loopUserApp() {
  if (millis() - lastDutyChangeAt < GERNETIX_USER_PWM_STEP_INTERVAL_MS) return;

  lastDutyChangeAt = millis();

  const uint32_t range = GERNETIX_USER_PWM_DUTY_MAX - GERNETIX_USER_PWM_DUTY_MIN;
  const uint32_t duty = GERNETIX_USER_PWM_DUTY_MIN + ((range * dutyStep) / GERNETIX_USER_PWM_STEPS);
  ledcWrite(GERNETIX_USER_PWM_CHANNEL, duty);

  dutyStep = (dutyStep + 1) % (GERNETIX_USER_PWM_STEPS + 1);
}
