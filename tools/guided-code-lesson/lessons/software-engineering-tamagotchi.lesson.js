"use strict";

(function registerLesson(registry) {
  function createSoftwareEngineeringTamagotchiLesson() {
    return {
      projectIdeaId: "project_idea.cross_platform_tamagotchi",
      projectVariantId: "variant.model_first_runtime_choice",
      slug: "software-engineering-tamagotchi",
      title: "Software Engineering mit Tamagotchi",
      file: "tamagotchi-verhaltensmodell.yaml",
      welcome: {
        eyebrow: "Modellbasierte Entwicklung",
        title: "Tamagotchi als Software-Engineering-Projekt",
        text: "In diesem Projekt geht es nicht darum, sofort Code zu schreiben. Du lernst, wie ein fachliches Modell Verhalten beschreibt und wie daraus später unterschiedliche Apps entstehen können.",
        topics: [
          "warum Quellcode für den Einstieg oft zu technisch ist",
          "wie Zustände, Werte, Regeln und Aktionen als Modell beschrieben werden",
          "warum das Modell unabhängig von Browser App und Embedded bleibt",
          "wann eine Browser App für den schnellen Einstieg sinnvoll ist",
          "welche Fragen später durch Zeitsteuerung und Speichern entstehen",
        ],
        startLabel: "Tamagotchi-Lektion starten",
      },
      completionSummary: {
        eyebrow: "Lernrückblick",
        title: "Was du im Tamagotchi-Projekt gelernt hast",
        text: "Du hast das Tamagotchi nicht zuerst als Code betrachtet, sondern als fachliches Modell. Dadurch wird sichtbar, warum modellbasierte Entwicklung hilft, Verhalten zu verstehen und später für verschiedene Runtimes umzusetzen.",
        learned: [
          "Quellcode ist eine technische Umsetzung, aber nicht die beste erste Erklärung für Verhalten.",
          "Ein Modell kann Zustände, Werte, Regeln und Aktionen lesbar beschreiben.",
          "Browser App und Embedded sind unterschiedliche Ausführungsformen desselben Modells.",
          "Die Browser App eignet sich für den schnellen Einstieg, zeigt aber auch Grenzen wie fehlende Persistenz.",
          "Die nächste Entwicklungsstufe ist eine zeitgesteuerte State-Machine mit gespeichertem Zustand.",
        ],
        next: "Als nächstes kann aus dem Modell eine einfache Browser App entstehen, danach folgen Tick-Logik und Speichern.",
      },
      learnerProfile: {
        boardKey: "unknown",
        selectedRuntime: "",
        tamagotchiTransitions: {
          hungryToSatt: "füttern",
          sattToHungry: "Hunger >= 50",
          hungryToDead: "Hunger = 100",
        },
        tamagotchiPlantUmlSource: tamagotchiPlantUmlBaseSource(),
      },
      runtimeDefaults: {
        selectedRuntime: "",
        tamagotchiTransitions: {
          hungryToSatt: "füttern",
          sattToHungry: "Hunger >= 50",
          hungryToDead: "Hunger = 100",
        },
        tamagotchiPlantUmlSource: tamagotchiPlantUmlBaseSource(),
      },
      boardProfiles: {
        unknown: { title: "Modellansicht" },
      },
      source: `Statische Quellcode-Datei: assets/tamagotchi-complete-example.c
  
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
    char person_id[32];
    uint8_t trust;
    uint32_t successful_interactions;
    uint32_t rejected_interactions;
    bool can_feed;
    bool can_drink;
    bool can_play;
    bool can_admin;
  } TamaKnownPerson;
  
  typedef struct {
    char name[24];
    TamaLife life;
    TamaHungerState hunger_state;
    TamaThirstState thirst_state;
    TamaEnergyState energy_state;
    TamaMood mood;
    TamaNeeds needs;
    TamaKnownPerson people[8];
    TamaMemory memories[16];
    TamaSyncEvent sync_queue[12];
    uint32_t last_tick_second;
    uint32_t last_fed_second;
    uint32_t last_drink_second;
    uint32_t last_clean_second;
    uint32_t last_play_second;
    bool dirty;
  } Tama;
  
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
    uint32_t elapsed = now_second - tama.last_tick_second;
    uint32_t ticks = elapsed / 3;
  
    for (uint32_t i = 0; i < ticks; i++) {
      change_need(&tama.needs.hunger, +1);
      change_need(&tama.needs.thirst, +1);
      change_need(&tama.needs.hygiene, -1);
      change_need(&tama.needs.energy, -1);
  
      if (tama.needs.hunger > 75 || tama.needs.thirst > 75) {
        change_need(&tama.needs.health, -1);
        change_need(&tama.needs.happiness, -2);
      }
    }
  
    tama.last_tick_second += ticks * 3;
    recompute_states();
    tama.dirty = true;
  }
  
  static bool apply_action(uint32_t now_second, const char *person_id, TamaAction action,
                           const char *payload) {
    TamaKnownPerson *person = find_person(person_id);
    if (!person_may_use_action(person, action) || tama.life == TAMA_LIFE_DEAD) {
      remember(now_second, person_id, action, "action rejected", -2, -1);
      return false;
    }
  
    switch (action) {
      case TAMA_ACTION_FEED:
        tama.needs.hunger = 0;
        tama.last_fed_second = now_second;
        remember(now_second, person_id, action, "fed Tama", +4, +1);
        break;
      case TAMA_ACTION_DRINK:
        tama.needs.thirst = 0;
        tama.last_drink_second = now_second;
        remember(now_second, person_id, action, "gave water", +3, +1);
        break;
      case TAMA_ACTION_PLAY:
        change_need(&tama.needs.happiness, +12);
        change_need(&tama.needs.energy, -8);
        change_need(&tama.needs.hygiene, -4);
        remember(now_second, person_id, action, payload, +7, +2);
        break;
      default:
        remember(now_second, person_id, action, "other action", 0, 0);
        break;
    }
  
    enqueue_sync(now_second, person_id, action);
    recompute_states();
    tama.dirty = true;
    return true;
  }
  
  Tamagotchi Verhaltensmodell
  
  problem:
    code_is_not_explanation: Quellcode zeigt Details, aber nicht sofort die Idee.
  
  model:
    source_of_truth: Das Modell beschreibt das Verhalten.
    runtime_independent: Dasselbe Modell kann mehrere Runtime-Apps erzeugen.
  
  states:
    life:
      initial: alive
      values:
        - alive
        - dead
    alive_substate:
      only_when: life == alive
      values:
        - hungry
        - satt
  
  values:
    hunger:
      scale: 0..100
      initial: 55
  
  rules:
    - if: hunger < 50
      then: alive_substate = satt
    - if: one_day_without_feeding
      then: life = dead
  
  actions:
    feed:
      effect:
        hunger: 0
        last_fed_at: now
  
  runtime_choice:
    question: Welche App soll aus dem Modell zuerst erzeugt werden?
    options:
      - browser_app
      - embedded
  
  runtime_apps:
    browser_app:
      why_first: schnell sichtbar auf Mac, PC und Mobile
      advantage: keine Installation, kein Board, kein Flashen
      disadvantage: ohne Speichern ist beim Browser-Schließen alles weg
    embedded:
      later: gleiches Modell, aber echte Hardware, Build, Flash, OTA und Gerätespeicher
  
  next_lesson:
    from: event_driven_user_interactions
    to: time_driven_state_machine_with_persistence
  `,
      steps: [
        {
          id: "step.tamagotchi_model.01_code_problem",
          flowItemId: "project_flow_item.tamagotchi_model.01",
          pattern: "step_pattern.motivation_problem",
          title: "Schau dir den Quellcode an",
          text:
            "Schau dir diese statische Quellcode-Datei an. Sie bildet schon sehr viele Ideen eines vollstaendigen Tamagotchis ab: Zustaende, Hunger, Durst, Aktionen, Gedächtnis, bekannte Personen und Synchronisation. Verstehst du sofort, welche fachliche Idee dahinter steckt?",
          outcome: "Der Lernende erlebt zuerst: Code enthält zwar die Logik, erklärt die fachliche Idee aber nicht gut.",
          focusLines: [1, 3, 4, 8, 9, 13, 14, 16],
          editableLines: [],
          completion: { type: "acknowledge", label: "Code angeschaut" },
        },
        {
          id: "step.tamagotchi_model.02_state_intro",
          flowItemId: "project_flow_item.tamagotchi_model.02",
          pattern: "step_pattern.state_introduction",
          title: "Einführung in Zustände",
          text:
            "Quellcode ist für Maschinen gemacht. Menschen können ihn schreiben, aber für andere Personen ist er oft schwer nachvollziehbar. Menschen verstehen viele Dinge leichter, wenn sie sie zuerst als Zustände betrachten. Eine Regentonne kann leer, halb voll oder voll sein. Ein Akku kann leer, halb voll oder voll sein.",
          outcome: "Der Lernende erkennt: Ein Objekt kann über einfache benannte Zustände beschrieben werden.",
          focusLines: [],
          editableLines: [],
          visual: {
            title: "Objekte in Zuständen",
            rows: [
              {
                label: "Regentonne",
                description: "Der Füllstand ist als Zustand leichter lesbar als als technische Messung.",
                states: [
                  { label: "leer", kind: "barrel", level: 0 },
                  { label: "halb voll", kind: "barrel", level: 50 },
                  { label: "voll", kind: "barrel", level: 100 },
                ],
              },
              {
                label: "Akku",
                description: "Auch beim Akku helfen einfache Namen, bevor über Spannung gesprochen wird.",
                states: [
                  { label: "leer", kind: "battery", level: 8 },
                  { label: "halb voll", kind: "battery", level: 50 },
                  { label: "voll", kind: "battery", level: 100 },
                ],
              },
            ],
          },
          completion: { type: "acknowledge", label: "Zustände gesehen" },
        },
        {
          id: "step.tamagotchi_model.03_state_categories",
          flowItemId: "project_flow_item.tamagotchi_model.03",
          pattern: "step_pattern.state_classification",
          title: "Einteilung von Zuständen",
          text:
            "Am Bild aus Schritt 2 sieht man bereits eine Einteilung. Manche Zustände sind direkt definiert: Eine Kaffeemaschine oder ein Fernseher ist an oder aus. Andere Eigenschaften sind fließend und haben von sich aus keine klaren Stufen. Temperatur, Punktzahl und Füllstand können viele Werte haben. Damit Menschen trotzdem damit arbeiten können, teilen sie solche Werte in benannte Zustände oder Klassen ein.",
          outcome: "Der Lernende unterscheidet direkte diskrete Zustände von fließenden Eigenschaften, die erst eingeteilt werden müssen.",
          focusLines: [],
          editableLines: [],
          visual: {
            title: "Direkt definiert oder eingeteilt",
            rows: [
              {
                label: "Direkt definiert",
                description: "Der Zustand ist bereits klar getrennt, zum Beispiel bei Kaffeemaschine oder Fernseher.",
                states: [
                  { label: "aus", kind: "power", value: "off", showValue: false },
                  { label: "an", kind: "power", value: "on", showValue: false },
                ],
              },
              {
                label: "Fliessend",
                description: "Der Wert verändert sich kontinuierlich und wird erst später klassifiziert.",
                states: [
                  { label: "Temperatur", kind: "thermometer", level: 58, value: "0..100 Grad" },
                  { label: "Punktzahl", kind: "label", value: "0..100" },
                  { label: "Füllstand", kind: "barrel", level: 50, value: "0..100 %" },
                ],
              },
            ],
          },
          completion: { type: "acknowledge", label: "Einteilung verstanden" },
        },
        {
          id: "step.tamagotchi_model.04_discrete_states",
          flowItemId: "project_flow_item.tamagotchi_model.04",
          pattern: "step_pattern.discrete_state_intro",
          title: "Direkte diskrete Zustände",
          text:
            "Wenn ein Objekt klar getrennte Zustände besitzt, kann man den Zustand direkt benennen. Zustände beschreibt man meistens mit Adjektiven oder kurzen Eigenschaftswörtern: Ein Fernseher ist an oder aus. Das Wetter kann sonnig, bewölkt, regnerisch oder windig sein. Manchmal enthält ein Zustand weitere Unterzustände: Eine Siebträgermaschine kann aus oder an sein; wenn sie an ist, kann sie aufheizend oder bereit sein.",
          outcome: "Der Lernende versteht: Diskrete Zustände können binär sein, mehrere Werte haben oder als Oberzustand weitere Unterzustände enthalten.",
          focusLines: [],
          editableLines: [],
          visual: {
            title: "Diskrete Zustände",
            rows: [
              {
                label: "Fernseher",
                description: "Zwei klare Zustände: an oder aus. Bei genau zwei Zuständen spricht man von binär.",
                states: [
                  { label: "aus", kind: "power", value: "off", showValue: false },
                  { label: "an", kind: "power", value: "on", showValue: false },
                ],
              },
              {
                label: "Wetter",
                description: "Diskrete Zustände müssen nicht nur zwei sein. Es können mehrere benannte Zustände nebeneinander stehen.",
                states: [
                  { label: "sonnig", kind: "weather", value: "sunny", showValue: false },
                  { label: "bewölkt", kind: "weather", value: "cloudy", showValue: false },
                  { label: "regnerisch", kind: "weather", value: "rainy", showValue: false },
                  { label: "windig", kind: "weather", value: "windy", showValue: false },
                ],
              },
              {
                label: "Siebträgermaschine",
                description: "Ein Oberzustand kann Unterzustände enthalten. In an liegen hier aufheizend und bereit.",
                states: [
                  { label: "aus", kind: "power", value: "off", showValue: false },
                  { label: "an", kind: "power", value: "on", showValue: false, substates: ["aufheizend", "bereit"] },
                ],
              },
            ],
          },
          completion: { type: "acknowledge", label: "Diskrete Zustände verstanden" },
        },
        {
          id: "step.tamagotchi_model.05_physical_property_rule",
          flowItemId: "project_flow_item.tamagotchi_model.05",
          pattern: "step_pattern.model_rule_introduction",
          title: "Aus Messwerten werden Zustände",
          text:
            "Wenn eine Eigenschaft fließend ist, brauchen wir eine Messgröße und Grenzen. Beim Stein ist die Messgröße die Temperatur, zum Beispiel gemessen mit PT1000 oder IR-Sensor. Für das Modell reduzieren wir sie auf drei Zustände: unter 10 Grad Celsius ist kalt, ab 10 Grad bis unter 55 Grad ist warm und ab 55 Grad ist heiß. Beim Füllstand einer Regentonne kann der Messwert zum Beispiel über Reedkontakte, Kamera mit Bildverarbeitung oder einen Schwimmer mit Seillänge erfasst werden. Beim Akku kann der Ladezustand vereinfacht über die Spannung erfasst werden: niedrige Spannung bedeutet leer, mittlere Spannung halb voll und hohe Spannung voll.",
          outcome: "Der Lernende erkennt: Aus einem kontinuierlichen Messwert werden durch Schwellen diskrete Zustände abgeleitet.",
          focusLines: [],
          editableLines: [],
          visual: {
            title: "Messwert, Schwelle und Zustand",
            rows: [
              {
                label: "Stein: Temperatur",
                description: "Messbar mit PT1000 oder IR-Sensor. Schwellen: unter 10 Grad kalt, ab 10 Grad warm, ab 55 Grad heiß.",
                states: [
                  { label: "unter 10 Grad", kind: "stone", tone: "cold", value: "Zustand = kalt" },
                  { label: "10 bis unter 55 Grad", kind: "stone", tone: "warm", value: "Zustand = warm" },
                  { label: "ab 55 Grad", kind: "stone", tone: "hot", value: "Zustand = heiß" },
                ],
              },
              {
                label: "Regentonne: Füllstand",
                description: "Erfassbar mit Reedkontakten, Kamera oder Schwimmer mit Seillänge.",
                states: [
                  { label: "niedrig", kind: "barrel", level: 10, value: "Zustand = leer" },
                  { label: "mittel", kind: "barrel", level: 50, value: "Zustand = halb voll" },
                  { label: "hoch", kind: "barrel", level: 100, value: "Zustand = voll" },
                ],
              },
              {
                label: "Akku: Spannung",
                description: "Der Ladezustand kann vereinfacht über die Spannung erfasst werden.",
                states: [
                  { label: "niedrige Spannung", kind: "battery", level: 8, value: "Zustand = leer" },
                  { label: "mittlere Spannung", kind: "battery", level: 50, value: "Zustand = halb voll" },
                  { label: "hohe Spannung", kind: "battery", level: 100, value: "Zustand = voll" },
                ],
              },
              {
                label: "Notensystem: Punktzahl",
                description: "Eine Punktzahl wird durch Grenzen in eine Note von 1 bis 6 übersetzt.",
                states: [
                  { label: "wenige Punkte", kind: "label", value: "Note 6" },
                  { label: "mittlere Punkte", kind: "label", value: "Note 3" },
                  { label: "viele Punkte", kind: "label", value: "Note 1" },
                ],
              },
            ],
          },
          completion: { type: "acknowledge", label: "Schwellen verstanden" },
        },
        {
          id: "step.tamagotchi_model.06_runtime_independent",
          flowItemId: "project_flow_item.tamagotchi_model.06",
          pattern: "step_pattern.state_machine_concept",
          title: "Aus Zuständen wird eine State Machine",
          text:
            "Jetzt haben wir die Grundlagen zusammen: Es gibt Zustände, und mit Transitionen wechselt ein System von einem Zustand in den nächsten. Eine Transition hat oft eine Bedingung, zum Beispiel eine messbare Größe mit Schwelle: Hunger >= 50 macht satt zu hungrig, oder Hunger = 100 macht hungrig zu tot. Dieses ganze Modell nennt man State Machine, auf Deutsch Zustandsmaschine. Bei der Regentonne sieht man das als kleinen Kreislauf: leer, Regen, voll, Gießen, wieder leer.",
          panelTextParts: [
            "Bei der Regentonne sieht man einen einfachen Kreislauf: Die Tonne ist leer. Durch Regen wird sie voll. Durch Gießen wird sie wieder leer.",
            "Damit sehen wir bereits eine State Machine, also eine Zustandsmaschine. Sie besteht aus States wie Tonne leer und Tonne voll sowie Transitionen wie Regen und Gießen. Transitionen beschreiben, wie ein System von einem State in den nächsten State wechselt.",
          ],
          outcome: "Der Lernende erkennt: Zustände, Transitionen und Bedingungen bilden zusammen eine State Machine beziehungsweise Zustandsmaschine.",
          focusLines: [],
          editableLines: [],
          visual: {
            type: "cycle",
            title: "Regentonnen-Zustandskreislauf",
            hideIntro: true,
            states: [
              { label: "Tonne leer", kind: "barrel", level: 0 },
              { label: "Tonne voll", kind: "barrel", level: 100 },
            ],
            transitions: [
              { label: "Regen" },
              { label: "Gießen" },
            ],
          },
          completion: { type: "acknowledge", label: "State Machine verstanden" },
        },
        {
          id: "step.tamagotchi_model.07_runtime_choice",
          flowItemId: "project_flow_item.tamagotchi_model.07",
          pattern: "step_pattern.state_machine_transition_conditions",
          title: "Eine State Machine mit PlantUML beschreiben",
          text:
            "Jetzt schreiben wir diese Zustandsmaschine als PlantUML. PlantUML beschreibt Diagramme mit Text: Zustände stehen als Zeilen im Text, Transitionen werden mit Pfeilen und Bedingungen beschrieben. Damit lassen sich State Machines komfortabel erzeugen, ohne Pfeile per Hand zu zeichnen. Der große Vorteil: KI und auch andere Tools können diese Sprache schnell und sicher verstehen und übersetzen. Aus einer präzisen PlantUML-Beschreibung kann später gezielter Code für die Ziel-Runtime erzeugt werden.",
          modelingNote: {
            title: "Hinweis zur Modellierung",
            paragraphs: [
              "In diesem Projekt verwenden wir ein UML-Statechart als Grundlage, um das Verhalten unseres Tamagotchis zu beschreiben. Unser Ziel ist dabei nicht, UML vollständig zu vermitteln oder eine UML-Schulung zu ersetzen.",
              "Viel wichtiger ist uns, die Ingenieurs-Denkweise zu vermitteln: Wie zerlegt man ein Problem? Wie beschreibt man Zustände, Übergänge und Regeln so, dass daraus später Software entstehen kann?",
              "Deshalb erweitern wir das Statechart an einigen Stellen um einfache Notizen, beispielsweise für Initialwerte oder zeitliche Regeln. Diese Notation ist kein offizieller Bestandteil der UML, sondern eine bewusst gewählte Erweiterung für unser Lernprojekt. Sie macht das Modell leichter verständlich und ermöglicht es, daraus automatisch lauffähigen Code zu erzeugen.",
              "Eine vollständige UML-Modellierung würde diese Informationen auf mehrere Diagrammtypen verteilen. Typischerweise würden:",
            ],
            bullets: [
              "Attribute und ihre Initialwerte in einem Klassendiagramm beschrieben,",
              "Zustände und Übergänge in einem Statechart modelliert,",
              "zeitliche Abläufe über Time Events, Aktivitäten oder Operationen definiert,",
              "komplexere Regeln gegebenenfalls mit OCL oder ergänzenden Spezifikationen beschrieben werden.",
            ],
            closing: [
              "Für unser Lernprojekt wäre dieser Umfang jedoch unnötig komplex und würde vom eigentlichen Lernziel ablenken. Deshalb konzentrieren wir uns auf die wesentlichen Konzepte und ergänzen das Statechart um wenige, leicht verständliche Angaben.",
              "Unser Ziel ist also nicht, UML auswendig zu lernen, sondern zu verstehen, wie man Software systematisch modelliert und daraus Schritt für Schritt eine funktionierende Anwendung entwickelt. Wer später professionell mit UML arbeitet, wird dieselben Ideen wiederfinden, allerdings auf mehrere, spezialisierte Modelle verteilt.",
            ],
          },
          outcome: "Der Lernende erkennt: PlantUML ist eine textuelle Schreibweise für die State Machine und kann von KI oder anderen Werkzeugen zuverlässig als Modellgrundlage verstanden werden.",
          focusLines: [],
          editableLines: [],
          visual: {
            type: "plantUmlMachine",
            title: "Tamagotchi-State-Machine",
            plantUmlSrc: "assets/tamagotchi-state-machine.puml",
            sourceField: "tamagotchiPlantUmlSource",
            plantUmlSource: tamagotchiPlantUmlBaseSource(),
            readonly: true,
            profileField: "tamagotchiTransitions",
            transitions: [
              {
                key: "sattToHungry",
                from: "satt",
                to: "hungrig",
                label: "satt -> hungrig",
                prompt: "Wann wird das Tamagotchi hungrig?",
              },
              {
                key: "hungryToSatt",
                from: "hungrig",
                to: "satt",
                label: "hungrig -> satt",
                prompt: "Was macht das Tamagotchi wieder satt?",
              },
              {
                key: "hungryToDead",
                from: "hungrig",
                to: "tot",
                label: "hungrig -> tot",
                prompt: "Wann stirbt das Tamagotchi?",
              },
            ],
          },
          completion: { type: "acknowledge", label: "PlantUML verstanden" },
          nextStepId: "step.tamagotchi_model.08_runtime_choice_duplicate",
        },
        {
          id: "step.tamagotchi_model.08_runtime_choice_duplicate",
          flowItemId: "project_flow_item.tamagotchi_model.08_runtime_choice_duplicate",
          pattern: "step_pattern.model_to_runtime_generation",
          title: "Aus PlantUML ein Browser-Programm erzeugen",
          text:
            "Das Ziel ist jetzt: Aus der PlantUML-State-Machine soll ein ausführbares Browser-Programm entstehen. Die PlantUML-Quelle beschreibt das Verhalten präzise. Wir erstellen daraus jetzt eine kleine Webanwendung.",
          outcome: "Der Lernende erkennt: PlantUML ist nicht nur ein Diagramm, sondern ein Modell, aus dem gezielt ausführbarer Browser-Code entstehen kann.",
          focusLines: [],
          editableLines: [],
          visual: {
            type: "plantUmlMachine",
            title: "Tamagotchi-State-Machine",
            plantUmlSrc: "assets/tamagotchi-state-machine.puml",
            sourceField: "tamagotchiPlantUmlSource",
            plantUmlSource: tamagotchiPlantUmlBaseSource(),
            profileField: "tamagotchiTransitions",
            transitions: [
              {
                key: "sattToHungry",
                from: "satt",
                to: "hungrig",
                label: "satt -> hungrig",
                prompt: "Wann wird das Tamagotchi hungrig?",
              },
              {
                key: "hungryToSatt",
                from: "hungrig",
                to: "satt",
                label: "hungrig -> satt",
                prompt: "Was macht das Tamagotchi wieder satt?",
              },
              {
                key: "hungryToDead",
                from: "hungrig",
                to: "tot",
                label: "hungrig -> tot",
                prompt: "Wann stirbt das Tamagotchi?",
              },
            ],
          },
          runtimePreview: {
            type: "tamagotchiBrowserApp",
            buttonLabel: "Run",
          },
          completion: { type: "acknowledge", label: "Browser-Ziel verstanden" },
          nextStepId: "step.tamagotchi_model.08_add_state",
        },
        {
          id: "step.tamagotchi_model.08_add_state",
          flowItemId: "project_flow_item.tamagotchi_model.08_add_state",
          pattern: "step_pattern.state_machine_extension",
          title: "Eine eigene Eigenschaft ergänzen",
          text:
            "Jetzt ergänzen wir eine weitere Eigenschaft des Tamagotchis. Beispiele wären Flüssigkeitsbedarf mit nicht durstig und durstig oder Stimmung mit ausgelastet und gelangweilt. In diesem Schritt befüllst du das Modell über den Button und siehst direkt, wie sich die PlantUML-Quelle und das Diagramm verändern.",
          outcome: "Der Lernende erkennt: Eigenschaften und ihre Zustände sind fachliche Modellierungsentscheidungen und können selbst gewählt werden.",
          focusLines: [],
          editableLines: [],
          visual: {
            type: "tamagotchiMachine",
            title: "Tamagotchi-State-Machine",
            sourceField: "tamagotchiPlantUmlSource",
            plantUmlSource: tamagotchiPlantUmlBaseSource(),
            readonly: true,
            insertHint: 'Füge zwei neue States ein: state "nicht durstig" as nicht_durstig und state "durstig" as durstig',
            exampleInsert: {
              label: "Beispiel einfügen: durstig",
              block: 'state "lebendig"',
              lines: [
                '  state "nicht durstig" as nicht_durstig',
                '  state "durstig" as durstig',
              ],
            },
          },
          validation: {
            type: "plantUmlAdditionalStateInBlock",
            profileField: "tamagotchiPlantUmlSource",
            block: 'state "lebendig"',
            existingAliases: ["satt", "hungrig"],
            minStates: 2,
            label: "mindestens zwei selbst gewählte zusätzliche States",
          },
          completion: { type: "acknowledge", label: "Eigene Eigenschaft ergänzt" },
          nextStepId: "step.tamagotchi_model.09_add_transition",
        },
        {
          id: "step.tamagotchi_model.09_add_transition",
          flowItemId: "project_flow_item.tamagotchi_model.09_add_transition",
          pattern: "step_pattern.transition_condition_extension",
          title: "Eine neue Übergangsbedingung ergänzen",
          text:
            "Ergänze jetzt eine Transition zwischen zwei Zuständen deiner neuen Eigenschaft. Beispiel: nicht_durstig --> durstig : Durst >= 50 oder ausgelastet --> gelangweilt : zu lange nicht gespielt. Damit wird sichtbar, dass selbst gewählte Eigenschaften eigene Übergänge, Aktionen und Bedingungen bekommen können.",
          outcome: "Der Lernende beschreibt eine fachliche Bedingung als Transition im PlantUML-Modell.",
          focusLines: [],
          editableLines: [],
          visual: {
            type: "tamagotchiMachine",
            title: "Tamagotchi-State-Machine",
            sourceField: "tamagotchiPlantUmlSource",
            plantUmlSource: tamagotchiPlantUmlBaseSource(),
            readonly: true,
            insertHint: "Verbinde zwei deiner neuen States mit einer Transition. Nach dem Einfügen kannst du die markierte Zeile ändern.",
            exampleInsert: {
              type: "transition",
              label: "Beispiel-Transition einfügen",
              block: 'state "lebendig"',
              existingAliases: ["satt", "hungrig"],
              fallback: {
                from: "nicht_durstig",
                to: "durstig",
                condition: "Durst >= 50",
              },
            },
          },
          validation: {
            type: "plantUmlTransitionToAdditionalState",
            profileField: "tamagotchiPlantUmlSource",
            block: 'state "lebendig"',
            existingAliases: ["satt", "hungrig"],
            minStates: 2,
            label: "Transition zwischen selbst gewählten neuen States",
          },
          completion: { type: "acknowledge", label: "Transition mit Bedingung ergänzt" },
          nextStepId: "step.tamagotchi_model.10_initial_values",
        },
        {
          id: "step.tamagotchi_model.10_initial_values",
          flowItemId: "project_flow_item.tamagotchi_model.10_initial_values",
          pattern: "step_pattern.transition_completeness",
          title: "Transition vollständig machen",
          text:
            "Prüfe jetzt die ergänzte Transition. Sie ist vollständig, wenn klar ist, von welchem State sie startet, in welchen State sie führt und welche Bedingung oder Aktion den Wechsel auslöst. Eine Vorlage wie Bedingung eintragen muss durch eine echte Regel ersetzt werden.",
          outcome: "Der Lernende erkennt: Eine Transition ist erst vollständig, wenn Start-State, Ziel-State und Auslöser klar beschrieben sind.",
          focusLines: [],
          editableLines: [],
          visual: {
            type: "tamagotchiMachine",
            title: "Tamagotchi-State-Machine",
            sourceField: "tamagotchiPlantUmlSource",
            plantUmlSource: tamagotchiPlantUmlBaseSource(),
            readonly: true,
            insertHint: "Kontrolliere die Transition deiner neuen States: Quelle --> Ziel : Bedingung oder Aktion.",
            exampleInsert: {
              type: "initialValueLineWithTransition",
              label: "Durst-Initialwert und Tod-Transition einfügen",
              noteStart: "note right of lebendig",
              line: "  Durst = 45",
              transitionLine: "durstig --> tot : Hunger >= 100",
            },
          },
          validation: {
            type: "plantUmlTransitionToAdditionalState",
            profileField: "tamagotchiPlantUmlSource",
            block: 'state "lebendig"',
            existingAliases: ["satt", "hungrig"],
            minStates: 2,
            label: "vollständige Transition zwischen selbst gewählten States",
            rejectConditions: ["Bedingung eintragen"],
          },
          completion: { type: "acknowledge", label: "Transition vollständig" },
          nextStepId: "step.tamagotchi_model.08_browser_first",
        },
        {
          id: "step.tamagotchi_model.08_browser_first",
          flowItemId: "project_flow_item.tamagotchi_model.08_browser",
          pattern: "step_pattern.model_to_runtime_execution",
          title: "Beispiel als Web-App ausführen",
          text:
            "Jetzt führen wir das aktuelle PlantUML-Beispiel als kleine Web-App aus. Der Run-Button öffnet eine Browser-Vorschau, die Initialwerte, Zustände und Transitionen aus dem Modell übernimmt.",
          outcome: "Der Lernende sieht: Aus dem PlantUML-Modell kann eine lauffähige Browser-App abgeleitet werden.",
          focusLines: [],
          editableLines: [],
          visual: {
            type: "tamagotchiMachine",
            title: "Tamagotchi-State-Machine",
            sourceField: "tamagotchiPlantUmlSource",
            plantUmlSource: tamagotchiPlantUmlBaseSource(),
            readonly: true,
            insertHint: "Das Modell links ist die Grundlage für die Web-App. Starte rechts die Vorschau mit Run.",
          },
          runtimePreview: {
            type: "tamagotchiBrowserApp",
            buttonLabel: "Run",
          },
          completion: { type: "acknowledge", label: "Web-App ausgeführt" },
          nextStepId: "step.tamagotchi_model.13_tick_rules",
        },
        {
          id: "step.tamagotchi_model.13_tick_rules",
          flowItemId: "project_flow_item.tamagotchi_model.13_tick_rules",
          pattern: "step_pattern.runtime_tick_rules",
          title: "Zählgeschwindigkeit ergänzen",
          text:
            "Wie du siehst, weiß das Modell noch nicht, wie schnell gezählt werden muss. Vielleicht ist euch das vorher schon aufgefallen. Falls nicht, ist das der nächste Aha-Moment. Damit wir weitere Effekte kurz nach dem Wechsel von satt zu hungrig und nicht durstig zu durstig sehen, ergänzen wir jetzt die Zählgeschwindigkeit für Hunger und Durst sowie die automatischen Zustandswechsel-Regeln explizit.",
          outcome: "Der Lernende erkennt: Neben States, Initialwerten und Transitionen braucht ein ausführbares Modell auch Regeln für zeitliche Veränderung.",
          focusLines: [],
          editableLines: [],
          visual: {
            type: "tamagotchiMachine",
            title: "Tamagotchi-State-Machine",
            sourceField: "tamagotchiPlantUmlSource",
            plantUmlSource: tamagotchiPlantUmlBaseSource(),
            readonly: true,
            insertHint: "Füge die Tick-Regeln ein: wie schnell Hunger und Durst steigen und welche automatischen Wechsel dadurch ausgelöst werden.",
            exampleInsert: {
              type: "initialValues",
              label: "Zählregeln einfügen",
              lines: [
                "note bottom of lebendig",
                "  Zählregeln",
                "  alle 3 Sekunden: Hunger = Hunger + 1",
                "  alle 3 Sekunden: Durst = Durst + 1",
                "  satt -> hungrig: Hunger >= 50",
                "  nicht_durstig -> durstig: Durst >= 50",
                "  hungrig -> tot: Hunger >= 100",
                "  durstig -> tot: Hunger >= 100",
                "end note",
              ],
            },
          },
          validation: {
            type: "profileTextContainsAll",
            profileField: "tamagotchiPlantUmlSource",
            contains: [
              "alle 3 Sekunden: Hunger = Hunger + 1",
              "alle 3 Sekunden: Durst = Durst + 1",
              "satt -> hungrig: Hunger >= 50",
              "nicht_durstig -> durstig: Durst >= 50",
              "hungrig -> tot: Hunger >= 100",
              "durstig -> tot: Hunger >= 100",
            ],
            label: "Zählgeschwindigkeit und automatische Zustandswechsel sind ergänzt",
          },
          runtimePreview: {
            type: "tamagotchiBrowserApp",
            buttonLabel: "Run",
          },
          completion: { type: "acknowledge", label: "Zählregeln ergänzt" },
          nextStepId: "step.tamagotchi_model.14_free_exploration",
        },
        {
          id: "step.tamagotchi_model.14_free_exploration",
          flowItemId: "project_flow_item.tamagotchi_model.14_free_exploration",
          pattern: "step_pattern.free_exploration",
          title: "Selber mit der State Machine forschen",
          text:
            "Jetzt darfst du die PlantUML-Quelle frei bearbeiten. Wenn das Diagramm danach angezeigt wird, ist die PlantUML-Syntax grundsätzlich gültig. Das heißt aber nicht automatisch, dass das Modell fachlich sinnvoll ist: Ein syntaktisch korrektes Modell kann widersprüchliche Zustände, unklare Übergänge oder wenig hilfreiche Regeln enthalten.",
          outcome: "Der Lernende erkennt: Syntaxprüfung und fachlich sinnvolle Modellierung sind zwei verschiedene Dinge.",
          focusLines: [],
          editableLines: [],
          visual: {
            type: "tamagotchiMachine",
            title: "Tamagotchi-State-Machine",
            sourceField: "tamagotchiPlantUmlSource",
            plantUmlSource: tamagotchiExplorationSource(),
            insertHint: "Bearbeite die PlantUML-Quelle frei. Das Diagramm zeigt dir, ob die Syntax noch verarbeitet werden kann.",
            resetSource: "exploration",
            resetLabel: "Zurücksetzen",
          },
          runtimePreview: {
            type: "tamagotchiBrowserApp",
            buttonLabel: "Run",
          },
          completion: { type: "acknowledge", label: "Freies Modell erforscht" },
          nextStepId: "step.tamagotchi_model.15_free_journey_summary",
        },
        {
          id: "step.tamagotchi_model.15_free_journey_summary",
          flowItemId: "project_flow_item.tamagotchi_model.15_free_journey_summary",
          pattern: "step_pattern.learning_summary_and_upgrade",
          title: "Tamas freie Reise endet hier",
          text:
            "Du hast Tama als Modell erforscht: Zustände beschrieben, Übergänge ergänzt, Bedingungen formuliert, Zählregeln eingefügt, eine Browser-App aus dem Modell gestartet und zuletzt frei mit PlantUML experimentiert. Damit ist die freie Reise mit Tama abgeschlossen. Im nächsten Kurs bekommt Tama neue spannende Funktionen:",
          endHighlights: [
            "Du kannst Tama füttern und tränken.",
            "Tama bekommt ein Gedächtnis.",
            "Tama wird zur echten Mobile App.",
            "Tama wird später zur Embedded App mit ESP32.",
            "Viele Geräte können auf ein und denselben Tama zugreifen.",
            "Tama spricht nur mit bekannten Leuten.",
            "Dieser nächste Abschnitt gehört in einen Bezahlplan.",
            "TODO: Bezahlplan definieren.",
          ],
          outcome: "Der Lernende erkennt, was im freien Tama-Pfad gelernt wurde und dass der anschließende vertiefende Pfad über einen noch zu definierenden Bezahlplan freigeschaltet werden soll.",
          focusLines: [],
          editableLines: [],
          endScreen: true,
          endButtonLabel: "Beenden",
          completion: { type: "acknowledge", label: "Freie Tama-Reise abgeschlossen" },
        },
        {
          id: "step.tamagotchi_model.08_embedded_preview",
          flowItemId: "project_flow_item.tamagotchi_model.08_embedded",
          pattern: "step_pattern.variant_comparison",
          title: "Embedded ist derselbe Modellkern",
          text:
            "Embedded ist kein anderes Tamagotchi. Dasselbe Modell wird später für Hardware, Build, Flash, OTA und Gerätespeicher erzeugt.",
          outcome: "Embedded ist als spätere Runtime-Variante eingeordnet.",
          focusLines: [67, 68],
          editableLines: [],
          completion: { type: "acknowledge", label: "Embedded-Pfad eingeordnet" },
          nextStepId: "step.tamagotchi_model.11_next_runtime_apps",
        },
        {
          id: "step.tamagotchi_model.09_browser_limits",
          flowItemId: "project_flow_item.tamagotchi_model.09",
          pattern: "step_pattern.problem_observation",
          title: "Vorteile und Nachteile sichtbar machen",
          text:
            "Die erste Browser App darf einfach sein: Benutzer klickt, Zustand ändert sich. Wenn nichts gespeichert wird, ist nach dem Schließen alles weg.",
          outcome: "Der Nachteil der ersten Browser-Version motiviert Persistenz.",
          focusLines: [64, 65, 66, 71, 72],
          editableLines: [],
          completion: { type: "acknowledge", label: "Grenze erkannt" },
        },
        {
          id: "step.tamagotchi_model.10_time_and_persistence",
          flowItemId: "project_flow_item.tamagotchi_model.10",
          pattern: "step_pattern.solution_introduction",
          title: "Nächste Lektion: Zeit und Speichern",
          text:
            "Danach wechseln wir von reinen Benutzerinteraktionen zu einer zeitgesteuerten State-Machine und speichern Modell/Zustand.",
          outcome: "Die nächste Lernstufe ist vorbereitet: Tick, State-Machine und Persistenz.",
          focusLines: [71, 72],
          editableLines: [],
          completion: { type: "acknowledge", label: "Nächste Lektion verstanden" },
        },
        {
          id: "step.tamagotchi_model.11_next_runtime_apps",
          flowItemId: "project_flow_item.tamagotchi_model.11",
          pattern: "step_pattern.reflection_inspiration_sales_bridge",
          title: "Weitere Apps aus demselben Modell",
          text:
            "Die Browser App ist nur der erste sichtbare Pfad. Danach kann dasselbe Modell in weitere Runtime-Apps übertragen werden, inklusive Embedded.",
          outcome: "Die langfristige Idee ist sichtbar: Modell zuerst, Runtime danach.",
          focusLines: [27, 59, 60, 62, 67],
          editableLines: [],
          completion: { type: "acknowledge", label: "Runtime-Idee verstanden" },
        },    ],
    };
  }
  
  function tamagotchiPlantUmlBaseSource() {
    return `@startuml
  title Tamagotchi State-Machine
  
  hide empty description
  
  skinparam shadowing false
  skinparam state {
    BackgroundColor #fbfdff
    BorderColor #9db0ca
    FontColor #08142b
    FontStyle bold
  }
  
  state "lebendig" as lebendig {
    state "satt" as satt
    state "hungrig" as hungrig
  }
  
  state "tot" as tot #fff7f7
  
  note right of lebendig
    Initialwerte
    Hunger = 45
  end note
  
  [*] --> lebendig
  satt --> hungrig : Hunger >= 50
  hungrig --> satt : füttern
  hungrig --> tot : Hunger = 100
  @enduml`;
  }
  
  function tamagotchiExplorationSource() {
    return `@startuml
  title Tamagotchi State-Machine
  
  hide empty description
  
  skinparam shadowing false
  skinparam state {
    BackgroundColor #fbfdff
    BorderColor #9db0ca
    FontColor #08142b
    FontStyle bold
  }
  
  state "lebendig" as lebendig {
    state "satt" as satt
    state "hungrig" as hungrig
    state "nicht durstig" as nicht_durstig
    state "durstig" as durstig
  }
  
  state "tot" as tot #fff7f7
  
  note right of lebendig
    Initialwerte
    Hunger = 45
    Durst = 45
  end note
  
  note bottom of lebendig
    Zählregeln
    alle 3 Sekunden: Hunger = Hunger + 1
    alle 3 Sekunden: Durst = Durst + 1
    satt -> hungrig: Hunger >= 50
    nicht_durstig -> durstig: Durst >= 50
    hungrig -> tot: Hunger >= 100
    durstig -> tot: Hunger >= 100
  end note
  
  [*] --> lebendig
  satt --> hungrig : Hunger >= 50
  hungrig --> satt : füttern
  hungrig --> tot : Hunger >= 100
  nicht_durstig --> durstig : Durst >= 50
  durstig --> tot : Hunger >= 100
  @enduml`;
  }

  registry.register({
    slug: "software-engineering-tamagotchi",
    create: createSoftwareEngineeringTamagotchiLesson,
  });
})(window.LearningProjectRegistry);
