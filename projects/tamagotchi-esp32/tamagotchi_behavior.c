#include <stdbool.h>
#include <stdint.h>

#include "esp_log.h"
#include "esp_timer.h"

#define TAMAGOTCHI_INITIAL_HUNGER 55
#define TAMAGOTCHI_SATIATED_LIMIT 50
#define TAMAGOTCHI_MIN_HUNGER 0
#define TAMAGOTCHI_DAY_WITHOUT_FOOD_US (24LL * 60LL * 60LL * 1000000LL)

static const char *TAG = "tamagotchi";

typedef enum {
  TAMAGOTCHI_LIFE_ALIVE,
  TAMAGOTCHI_LIFE_DEAD
} TamagotchiLifeState;

typedef enum {
  TAMAGOTCHI_ALIVE_HUNGRY,
  TAMAGOTCHI_ALIVE_SATIATED
} TamagotchiAliveState;

typedef struct {
  TamagotchiLifeState life_state;
  TamagotchiAliveState alive_state;
  uint8_t hunger;
  int64_t last_fed_at_us;
} Tamagotchi;

static Tamagotchi tamagotchi;

static const char *lifeStateName(TamagotchiLifeState state) {
  switch (state) {
    case TAMAGOTCHI_LIFE_ALIVE:
      return "alive";
    case TAMAGOTCHI_LIFE_DEAD:
      return "dead";
    default:
      return "unknown";
  }
}

static const char *aliveStateName(TamagotchiAliveState state) {
  switch (state) {
    case TAMAGOTCHI_ALIVE_HUNGRY:
      return "hungry";
    case TAMAGOTCHI_ALIVE_SATIATED:
      return "satt";
    default:
      return "unknown";
  }
}

static TamagotchiAliveState aliveStateForHunger(uint8_t hunger) {
  if (hunger < TAMAGOTCHI_SATIATED_LIMIT) {
    return TAMAGOTCHI_ALIVE_SATIATED;
  }

  return TAMAGOTCHI_ALIVE_HUNGRY;
}

static void updateAliveStateFromHunger(void) {
  if (tamagotchi.life_state != TAMAGOTCHI_LIFE_ALIVE) {
    return;
  }

  const TamagotchiAliveState next_state = aliveStateForHunger(tamagotchi.hunger);
  if (next_state == tamagotchi.alive_state) {
    return;
  }

  ESP_LOGI(TAG, "alive sub-state: %s -> %s", aliveStateName(tamagotchi.alive_state), aliveStateName(next_state));
  tamagotchi.alive_state = next_state;
}

static void updateLifeStateFromFeedingTime(int64_t now_us) {
  if (tamagotchi.life_state != TAMAGOTCHI_LIFE_ALIVE) {
    return;
  }

  if (now_us - tamagotchi.last_fed_at_us < TAMAGOTCHI_DAY_WITHOUT_FOOD_US) {
    return;
  }

  tamagotchi.life_state = TAMAGOTCHI_LIFE_DEAD;
  ESP_LOGI(TAG, "life-state: alive -> dead; not fed for one day");
}

void tamagotchiFeed(void) {
  if (tamagotchi.life_state != TAMAGOTCHI_LIFE_ALIVE) {
    ESP_LOGI(TAG, "feed ignored; tamagotchi is %s", lifeStateName(tamagotchi.life_state));
    return;
  }

  tamagotchi.hunger = TAMAGOTCHI_MIN_HUNGER;
  tamagotchi.last_fed_at_us = esp_timer_get_time();
  updateAliveStateFromHunger();

  ESP_LOGI(TAG, "fed; hunger=%u, alive_state=%s", tamagotchi.hunger, aliveStateName(tamagotchi.alive_state));
}

uint8_t tamagotchiGetHunger(void) {
  return tamagotchi.hunger;
}

bool tamagotchiIsAlive(void) {
  return tamagotchi.life_state == TAMAGOTCHI_LIFE_ALIVE;
}

const char *tamagotchiGetLifeStateName(void) {
  return lifeStateName(tamagotchi.life_state);
}

const char *tamagotchiGetAliveStateName(void) {
  if (tamagotchi.life_state != TAMAGOTCHI_LIFE_ALIVE) {
    return "none";
  }

  return aliveStateName(tamagotchi.alive_state);
}

void onProjectInit(void) {
  tamagotchi.life_state = TAMAGOTCHI_LIFE_ALIVE;
  tamagotchi.hunger = TAMAGOTCHI_INITIAL_HUNGER;
  tamagotchi.alive_state = aliveStateForHunger(tamagotchi.hunger);
  tamagotchi.last_fed_at_us = esp_timer_get_time();

  ESP_LOGI(
      TAG,
      "started; life_state=%s, alive_state=%s, hunger=%u",
      lifeStateName(tamagotchi.life_state),
      aliveStateName(tamagotchi.alive_state),
      tamagotchi.hunger);
}

void onProjectTick(void) {
  const int64_t now_us = esp_timer_get_time();

  updateLifeStateFromFeedingTime(now_us);
  updateAliveStateFromHunger();
}



