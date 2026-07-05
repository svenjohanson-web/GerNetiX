/*
 * Static source file for lesson step 1.
 *
 * This file intentionally shows a lot of implementation detail at once.
 * It sketches a complete Tamagotchi runtime: needs, state transitions, user
 * actions, memory, trusted people, persistence, sync and app/embedded events.
 * The lesson uses it as a contrast to a small, readable state model.
 */

#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#define TAMA_MAX_VALUE 100
#define TAMA_MIN_VALUE 0
#define TAMA_MEMORY_SLOTS 16
#define TAMA_KNOWN_PEOPLE 8
#define TAMA_SYNC_QUEUE 12
#define TAMA_NAME_LENGTH 24
#define TAMA_PERSON_LENGTH 32
#define TAMA_MEMORY_TEXT_LENGTH 64

typedef enum {
  TAMA_LIFE_ALIVE,
  TAMA_LIFE_DEAD
} TamaLife;

typedef enum {
  TAMA_HUNGER_SATIATED,
  TAMA_HUNGER_HUNGRY,
  TAMA_HUNGER_STARVING
} TamaHungerState;

typedef enum {
  TAMA_THIRST_OK,
  TAMA_THIRST_THIRSTY,
  TAMA_THIRST_DEHYDRATED
} TamaThirstState;

typedef enum {
  TAMA_MOOD_HAPPY,
  TAMA_MOOD_BORED,
  TAMA_MOOD_SAD,
  TAMA_MOOD_ANGRY
} TamaMood;

typedef enum {
  TAMA_ENERGY_AWAKE,
  TAMA_ENERGY_TIRED,
  TAMA_ENERGY_SLEEPING
} TamaEnergyState;

typedef enum {
  TAMA_ACTION_FEED,
  TAMA_ACTION_DRINK,
  TAMA_ACTION_PLAY,
  TAMA_ACTION_SLEEP,
  TAMA_ACTION_WAKE,
  TAMA_ACTION_CLEAN,
  TAMA_ACTION_TALK,
  TAMA_ACTION_MEDICINE
} TamaAction;

typedef enum {
  TAMA_EVENT_APP_BUTTON,
  TAMA_EVENT_SENSOR,
  TAMA_EVENT_TIMER,
  TAMA_EVENT_NETWORK,
  TAMA_EVENT_BOOT
} TamaEventKind;

typedef struct {
  char person_id[TAMA_PERSON_LENGTH];
  uint8_t trust;
  uint32_t successful_interactions;
  uint32_t rejected_interactions;
  bool can_feed;
  bool can_drink;
  bool can_play;
  bool can_admin;
} TamaKnownPerson;

typedef struct {
  uint32_t at_second;
  char person_id[TAMA_PERSON_LENGTH];
  TamaAction action;
  char text[TAMA_MEMORY_TEXT_LENGTH];
  int8_t mood_delta;
  int8_t trust_delta;
} TamaMemory;

typedef struct {
  uint32_t sequence;
  TamaAction action;
  uint32_t local_second;
  char person_id[TAMA_PERSON_LENGTH];
  bool sent;
} TamaSyncEvent;

typedef struct {
  uint8_t hunger;
  uint8_t thirst;
  uint8_t energy;
  uint8_t happiness;
  uint8_t hygiene;
  uint8_t health;
  uint8_t affection;
  uint16_t age_days;
  uint16_t coins;
} TamaNeeds;

typedef struct {
  char name[TAMA_NAME_LENGTH];
  TamaLife life;
  TamaHungerState hunger_state;
  TamaThirstState thirst_state;
  TamaEnergyState energy_state;
  TamaMood mood;
  TamaNeeds needs;
  TamaKnownPerson people[TAMA_KNOWN_PEOPLE];
  TamaMemory memories[TAMA_MEMORY_SLOTS];
  TamaSyncEvent sync_queue[TAMA_SYNC_QUEUE];
  uint8_t memory_cursor;
  uint8_t sync_cursor;
  uint32_t created_at_second;
  uint32_t last_tick_second;
  uint32_t last_fed_second;
  uint32_t last_drink_second;
  uint32_t last_clean_second;
  uint32_t last_play_second;
  uint32_t last_saved_second;
  bool dirty;
} Tama;

typedef struct {
  TamaEventKind kind;
  TamaAction action;
  uint32_t now_second;
  char person_id[TAMA_PERSON_LENGTH];
  char payload[TAMA_MEMORY_TEXT_LENGTH];
} TamaEvent;

static Tama tama;

static uint8_t clamp_need(int16_t value) {
  if (value < TAMA_MIN_VALUE) {
    return TAMA_MIN_VALUE;
  }
  if (value > TAMA_MAX_VALUE) {
    return TAMA_MAX_VALUE;
  }
  return (uint8_t)value;
}

static void change_need(uint8_t *need, int8_t delta) {
  *need = clamp_need((int16_t)(*need) + delta);
}

static TamaKnownPerson *find_person(const char *person_id) {
  for (uint8_t i = 0; i < TAMA_KNOWN_PEOPLE; i++) {
    if (strcmp(tama.people[i].person_id, person_id) == 0) {
      return &tama.people[i];
    }
  }
  return 0;
}

static bool person_may_use_action(const TamaKnownPerson *person, TamaAction action) {
  if (person == 0) {
    return false;
  }
  if (person->can_admin) {
    return true;
  }
  if (action == TAMA_ACTION_FEED) {
    return person->can_feed;
  }
  if (action == TAMA_ACTION_DRINK) {
    return person->can_drink;
  }
  if (action == TAMA_ACTION_PLAY || action == TAMA_ACTION_TALK) {
    return person->can_play;
  }
  return false;
}

static void remember(uint32_t now_second, const char *person_id, TamaAction action,
                     const char *text, int8_t mood_delta, int8_t trust_delta) {
  TamaMemory *slot = &tama.memories[tama.memory_cursor % TAMA_MEMORY_SLOTS];
  slot->at_second = now_second;
  slot->action = action;
  slot->mood_delta = mood_delta;
  slot->trust_delta = trust_delta;
  strncpy(slot->person_id, person_id, TAMA_PERSON_LENGTH - 1);
  strncpy(slot->text, text, TAMA_MEMORY_TEXT_LENGTH - 1);
  tama.memory_cursor++;
  tama.dirty = true;
}

static void enqueue_sync(uint32_t now_second, const char *person_id, TamaAction action) {
  TamaSyncEvent *event = &tama.sync_queue[tama.sync_cursor % TAMA_SYNC_QUEUE];
  event->sequence++;
  event->local_second = now_second;
  event->action = action;
  event->sent = false;
  strncpy(event->person_id, person_id, TAMA_PERSON_LENGTH - 1);
  tama.sync_cursor++;
}

static void recompute_states(void) {
  if (tama.needs.hunger >= 100 || tama.needs.thirst >= 100 || tama.needs.health == 0) {
    tama.life = TAMA_LIFE_DEAD;
    return;
  }

  if (tama.needs.hunger >= 85) {
    tama.hunger_state = TAMA_HUNGER_STARVING;
  } else if (tama.needs.hunger >= 50) {
    tama.hunger_state = TAMA_HUNGER_HUNGRY;
  } else {
    tama.hunger_state = TAMA_HUNGER_SATIATED;
  }

  if (tama.needs.thirst >= 85) {
    tama.thirst_state = TAMA_THIRST_DEHYDRATED;
  } else if (tama.needs.thirst >= 50) {
    tama.thirst_state = TAMA_THIRST_THIRSTY;
  } else {
    tama.thirst_state = TAMA_THIRST_OK;
  }

  if (tama.needs.energy <= 10) {
    tama.energy_state = TAMA_ENERGY_SLEEPING;
  } else if (tama.needs.energy <= 35) {
    tama.energy_state = TAMA_ENERGY_TIRED;
  } else {
    tama.energy_state = TAMA_ENERGY_AWAKE;
  }

  if (tama.needs.happiness >= 70 && tama.needs.hygiene >= 40) {
    tama.mood = TAMA_MOOD_HAPPY;
  } else if (tama.needs.happiness < 25) {
    tama.mood = TAMA_MOOD_SAD;
  } else if (tama.needs.hunger >= 80 || tama.needs.thirst >= 80) {
    tama.mood = TAMA_MOOD_ANGRY;
  } else {
    tama.mood = TAMA_MOOD_BORED;
  }
}

static void apply_time(uint32_t now_second) {
  if (tama.last_tick_second == 0) {
    tama.last_tick_second = now_second;
    return;
  }

  uint32_t elapsed = now_second - tama.last_tick_second;
  uint32_t ticks = elapsed / 3;
  if (ticks == 0) {
    return;
  }

  for (uint32_t i = 0; i < ticks; i++) {
    change_need(&tama.needs.hunger, +1);
    change_need(&tama.needs.thirst, +1);
    change_need(&tama.needs.hygiene, -1);

    if (tama.energy_state == TAMA_ENERGY_SLEEPING) {
      change_need(&tama.needs.energy, +3);
      change_need(&tama.needs.happiness, -1);
    } else {
      change_need(&tama.needs.energy, -1);
    }

    if (tama.needs.hunger > 75 || tama.needs.thirst > 75) {
      change_need(&tama.needs.health, -1);
      change_need(&tama.needs.happiness, -2);
    }
  }

  tama.last_tick_second += ticks * 3;
  tama.needs.age_days = (uint16_t)((now_second - tama.created_at_second) / 86400);
  recompute_states();
  tama.dirty = true;
}

static bool apply_action(uint32_t now_second, const char *person_id, TamaAction action,
                         const char *payload) {
  TamaKnownPerson *person = find_person(person_id);
  if (!person_may_use_action(person, action) || tama.life == TAMA_LIFE_DEAD) {
    if (person != 0) {
      person->rejected_interactions++;
    }
    remember(now_second, person_id, action, "action rejected", -2, -1);
    return false;
  }

  person->successful_interactions++;
  switch (action) {
    case TAMA_ACTION_FEED:
      tama.needs.hunger = 0;
      change_need(&tama.needs.happiness, +5);
      tama.last_fed_second = now_second;
      remember(now_second, person_id, action, "fed Tama", +4, +1);
      break;
    case TAMA_ACTION_DRINK:
      tama.needs.thirst = 0;
      change_need(&tama.needs.happiness, +4);
      tama.last_drink_second = now_second;
      remember(now_second, person_id, action, "gave water", +3, +1);
      break;
    case TAMA_ACTION_PLAY:
      change_need(&tama.needs.happiness, +12);
      change_need(&tama.needs.energy, -8);
      change_need(&tama.needs.hygiene, -4);
      tama.last_play_second = now_second;
      remember(now_second, person_id, action, payload, +7, +2);
      break;
    case TAMA_ACTION_SLEEP:
      tama.energy_state = TAMA_ENERGY_SLEEPING;
      remember(now_second, person_id, action, "sleep started", +1, 0);
      break;
    case TAMA_ACTION_WAKE:
      tama.energy_state = TAMA_ENERGY_AWAKE;
      remember(now_second, person_id, action, "wake up", 0, 0);
      break;
    case TAMA_ACTION_CLEAN:
      tama.needs.hygiene = 100;
      tama.last_clean_second = now_second;
      remember(now_second, person_id, action, "cleaned Tama", +2, +1);
      break;
    case TAMA_ACTION_TALK:
      change_need(&tama.needs.affection, +2);
      change_need(&tama.needs.happiness, +3);
      remember(now_second, person_id, action, payload, +2, +2);
      break;
    case TAMA_ACTION_MEDICINE:
      change_need(&tama.needs.health, +20);
      change_need(&tama.needs.happiness, -3);
      remember(now_second, person_id, action, "medicine", -1, +1);
      break;
  }

  enqueue_sync(now_second, person_id, action);
  recompute_states();
  tama.dirty = true;
  return true;
}

static void save_if_needed(uint32_t now_second) {
  if (!tama.dirty) {
    return;
  }
  if (now_second - tama.last_saved_second < 10) {
    return;
  }

  /* Platform code would write tama to flash, a file or IndexedDB here. */
  tama.last_saved_second = now_second;
  tama.dirty = false;
}

static void sync_if_possible(void) {
  for (uint8_t i = 0; i < TAMA_SYNC_QUEUE; i++) {
    TamaSyncEvent *event = &tama.sync_queue[i];
    if (!event->sent && event->sequence != 0) {
      /* Platform code would send this event to a home server here. */
      event->sent = true;
    }
  }
}

void tama_boot(uint32_t now_second) {
  memset(&tama, 0, sizeof(tama));
  strncpy(tama.name, "Tama", TAMA_NAME_LENGTH - 1);
  tama.life = TAMA_LIFE_ALIVE;
  tama.needs.hunger = 35;
  tama.needs.thirst = 25;
  tama.needs.energy = 80;
  tama.needs.happiness = 65;
  tama.needs.hygiene = 90;
  tama.needs.health = 100;
  tama.needs.affection = 20;
  tama.created_at_second = now_second;
  tama.last_tick_second = now_second;

  strncpy(tama.people[0].person_id, "owner", TAMA_PERSON_LENGTH - 1);
  tama.people[0].trust = 100;
  tama.people[0].can_feed = true;
  tama.people[0].can_drink = true;
  tama.people[0].can_play = true;
  tama.people[0].can_admin = true;

  recompute_states();
  tama.dirty = true;
}

void tama_handle_event(const TamaEvent *event) {
  if (event == 0) {
    return;
  }

  apply_time(event->now_second);

  if (event->kind == TAMA_EVENT_APP_BUTTON ||
      event->kind == TAMA_EVENT_SENSOR ||
      event->kind == TAMA_EVENT_NETWORK) {
    apply_action(event->now_second, event->person_id, event->action, event->payload);
  }

  save_if_needed(event->now_second);
  sync_if_possible();
}
