const LearningProjectLocales = (() => {
  const projects = {
    en: {
    "arduino-blink": ["Arduino Blink", "A small blinking project for the first USB flash on an Arduino-compatible board."],
    "arduino-atmel-bare-metal": ["Arduino Atmel/AVR without Arduino", "Bare-metal base software for Arduino-compatible AVR boards with avr-libc, build and USB flashing."],
    "software-engineering-tamagotchi": ["Software Engineering with Tamagotchi", "Understand behaviour before writing code."],
    "smart-assistant-ai-automation": ["Build your own smart assistant", "Connect voice and automation services with GPT, Gemini or Claude and design your own hardware implementation."],
    "button-to-smartphone-notification": ["From button press to smartphone notification", "Understand a complete yet approachable event chain from an IoT button to a private smartphone PWA."],
    "home-automation-network": ["Build your own home automation network", "Build a local ESP32 home node and extend it step by step into a Home Assistant-compatible home automation network."],
    "motor-control-basics": ["Motor control: move safely", "Control a small DC motor through an H-bridge driver and build a traceable, limited movement with feedback."],
    "build-your-own-proximity-sensor": ["Build your own proximity sensor", "Explore an FMCW radar module and develop a traceable proximity or presence detector from it."],
    "programming-fundamentals": ["Programming fundamentals", "Start with input, processing, output and memory, then use small JavaScript examples to learn variables, arithmetic, decisions, loops and functions."],
    "uml-fundamentals": ["UML fundamentals – diagrams people and machines understand", "Learn UML as a shared visual language and describe simple systems so that people can discuss them and tools can process them."],
    "yaml-fundamentals": ["YAML fundamentals – describe structured data clearly", "Learn YAML without prior knowledge and create a small project configuration with values, lists and nested structures."],
    "storage-learning-story": ["From a stored value to a data platform", "Build the data storage for an intelligent plant station step by step: first without persistent storage, then on the ESP32 and finally on a local server."],
    "measurement-tools-basics": ["Using measurement tools", "Use a multimeter, logic analyzer and oscilloscope to test safe low-voltage circuits systematically."],
    "chicken-coop-door-smartphone-app": ["Build your own smartphone app for the chicken-coop door", "Develop an installable smartphone web app that controls a safe coop door through Wi-Fi or a LoRa gateway and only displays confirmed states."],
    "plant-watering-control": ["Plant watering control", "Measure moisture and switch a pump in a controlled way."],
    },
    nl: {
      "arduino-blink": ["Arduino Blink", "Een klein knipperproject voor de eerste USB-flash op een Arduino-compatibel board."],
      "arduino-atmel-bare-metal": ["Arduino Atmel/AVR zonder Arduino", "Bare-metal-basissoftware voor Arduino-compatibele AVR-boards met avr-libc, build en USB-flashing."],
      "software-engineering-tamagotchi": ["Software-engineering met Tamagotchi", "Begrijp het gedrag voordat je code schrijft."],
      "smart-assistant-ai-automation": ["Bouw je eigen slimme assistent", "Verbind spraak- en automatiseringsdiensten met GPT, Gemini of Claude en ontwerp je eigen hardware-implementatie."],
      "button-to-smartphone-notification": ["Van druk op de knop tot smartphone-melding", "Begrijp een volledige maar toegankelijke gebeurtenisketen van een IoT-knop tot een privé-smartphone-PWA."],
    "home-automation-network": ["Bouw je eigen domoticanetwerk", "Bouw een lokale ESP32-homenode en breid deze stap voor stap uit tot een Home Assistant-compatibel domoticanetwerk."],
    "motor-control-basics": ["Motorbesturing: beweging veilig sturen", "Bestuur een kleine DC-motor via een H-brugdriver en bouw een navolgbare, begrensde beweging met terugkoppeling."],
    "build-your-own-proximity-sensor": ["Bouw je eigen naderingssensor", "Onderzoek een FMCW-radarmodule en ontwikkel daaruit een navolgbare nabijheids- of aanwezigheidsdetector."],
      "programming-fundamentals": ["Basiskennis programmeren", "Begin met invoer, verwerking, uitvoer en geheugen en leer daarna met kleine JavaScript-voorbeelden variabelen, rekenen, beslissingen, lussen en functies."],
      "uml-fundamentals": ["UML-basis – diagrammen die mens en machine begrijpen", "Leer UML als gemeenschappelijke visuele taal en beschrijf eenvoudige systemen zodat mensen ze kunnen bespreken en hulpmiddelen ze kunnen verwerken."],
      "yaml-fundamentals": ["YAML-basis – gestructureerde gegevens duidelijk beschrijven", "Leer YAML zonder voorkennis en maak een kleine projectconfiguratie met waarden, lijsten en geneste structuren."],
      "storage-learning-story": ["Van opgeslagen waarde naar dataplatform", "Bouw de gegevensopslag voor een intelligent plantenstation stap voor stap: eerst zonder permanente opslag, daarna op de ESP32 en ten slotte op een lokale server."],
      "measurement-tools-basics": ["Werken met meetinstrumenten", "Onderzoek veilige laagspanningsschakelingen systematisch met multimeter, logic analyzer en oscilloscoop."],
      "chicken-coop-door-smartphone-app": ["Bouw je eigen smartphone-app voor de kippenhokdeur", "Ontwikkel een installeerbare smartphone-webapp die een veilige kippenhokdeur via wifi of een LoRa-gateway bedient en alleen bevestigde toestanden toont."],
      "plant-watering-control": ["Besturing van plantenbewatering", "Meet vocht en schakel een pomp gecontroleerd in."],
    },
  };

  const ui = {
    de: {
      allTags: "Alle Tags", emptyCatalog: "Im Lernprojekt-Katalog sind noch keine Projekte verfügbar.",
      project: "Projekt", status: "Status", progress: "Fortschritt", device: "Device",
      noDevice: "kein Device", continue: "Fortsetzen", start: "Starten", emptyPersonal: "Keine Projekte für diesen Filter.",
      notFoundEyebrow: "Lernprojekt", notFoundTitle: "Projekt nicht gefunden", notFoundText: "Dieses Lernprojekt ist im aktuellen Katalog nicht verfügbar.",
      back: "Zurück", about: "Worum geht es in diesem Projekt?", learningGoal: "Was du lernst", workingMethod: "So arbeitest du", result: "Dein Ergebnis",
      structureEyebrow: "Projektaufbau", structureTitle: "So ist das Projekt aufgebaut",
      structureText: "Fünf Etappen führen dich von einfachen Daten im Arbeitsspeicher bis zur durchsuchbaren Datenbank und zum Dateiarchiv.",
      hardware: "Praxisabschnitt mit ESP32", noHardware: "Ohne zusätzliche Hardware",
      noLessons: "Die Lessons für dieses Lernprojekt werden noch zugeordnet.", startProject: "Lernprojekt starten",
      guided: "Geführtes Lernprojekt", story: "Entwicklungsprojekt · Projektstory", standalone: "Entwicklungslesson · einzeln gestartet",
      prepared: "Vorbereiteter Einzelstart", allProjects: "Alle Lernprojekte",
      lessons: "Lessons", step: "Schritt", steps: "Schritte", completed: "erledigt", projectProgress: "Projektfortschritt", showProgressDetails: "Lessons und Schritte anzeigen",
      welcomeBack: "Willkommen zurück", startChoiceTitle: "Wie möchtest du beginnen?", startChoiceText: "Für dieses Lernprojekt ist bereits ein Fortschritt gespeichert.",
      lastPosition: "Dein letzter Stand", startNew: "Neu beginnen", continueLast: "Am letzten Stand fortsetzen",
      resettingProgress: "Fortschritt wird zurückgesetzt …", resetProgressFailed: "Der Lernfortschritt konnte nicht zurückgesetzt werden.",
      ready: "bereit", running: "laufend", finished: "abgeschlossen",
    },
    en: {
      allTags: "All tags", emptyCatalog: "No projects are available in the learning project catalog yet.",
      project: "Project", status: "Status", progress: "Progress", device: "Device",
      noDevice: "no device", continue: "Continue", start: "Start", emptyPersonal: "No projects match this filter.",
      notFoundEyebrow: "Learning project", notFoundTitle: "Project not found", notFoundText: "This learning project is not available in the current catalog.",
      back: "Back", about: "What is this project about?", learningGoal: "What you will learn", workingMethod: "How you will work", result: "Your result",
      structureEyebrow: "Project structure", structureTitle: "How the project is structured",
      structureText: "Five stages take you from simple data in working memory to a searchable database and file archive.",
      hardware: "Practical section with ESP32", noHardware: "No additional hardware",
      noLessons: "The lessons for this learning project are still being assigned.", startProject: "Start learning project",
      guided: "Guided learning project", story: "Development project · project story", standalone: "Development lesson · started separately",
      prepared: "Prepared standalone start", allProjects: "All learning projects",
      lessons: "lessons", step: "step", steps: "steps", completed: "completed", projectProgress: "Project progress", showProgressDetails: "Show lessons and steps",
      welcomeBack: "Welcome back", startChoiceTitle: "How would you like to begin?", startChoiceText: "Progress has already been saved for this learning project.",
      lastPosition: "Your last position", startNew: "Start again", continueLast: "Continue from the last position",
      resettingProgress: "Resetting progress …", resetProgressFailed: "The learning progress could not be reset.",
      ready: "ready", running: "in progress", finished: "completed",
    },
    nl: {
      allTags: "Alle tags", emptyCatalog: "Er zijn nog geen projecten beschikbaar in de leerprojectcatalogus.",
      project: "Project", status: "Status", progress: "Voortgang", device: "Apparaat",
      noDevice: "geen apparaat", continue: "Doorgaan", start: "Starten", emptyPersonal: "Geen projecten voor dit filter.",
      notFoundEyebrow: "Leerproject", notFoundTitle: "Project niet gevonden", notFoundText: "Dit leerproject is niet beschikbaar in de huidige catalogus.",
      back: "Terug", about: "Waar gaat dit project over?", learningGoal: "Wat je leert", workingMethod: "Zo werk je", result: "Jouw resultaat",
      structureEyebrow: "Projectopbouw", structureTitle: "Zo is het project opgebouwd",
      structureText: "Vijf fasen brengen je van eenvoudige gegevens in het werkgeheugen naar een doorzoekbare database en een bestandsarchief.",
      hardware: "Praktijkgedeelte met ESP32", noHardware: "Geen extra hardware",
      noLessons: "De lessen voor dit leerproject worden nog toegewezen.", startProject: "Leerproject starten",
      guided: "Begeleid leerproject", story: "Ontwikkelproject · projectverhaal", standalone: "Ontwikkelles · afzonderlijk gestart",
      prepared: "Voorbereide afzonderlijke start", allProjects: "Alle leerprojecten",
      lessons: "lessen", step: "stap", steps: "stappen", completed: "voltooid", projectProgress: "Projectvoortgang", showProgressDetails: "Lessen en stappen tonen",
      welcomeBack: "Welkom terug", startChoiceTitle: "Hoe wil je beginnen?", startChoiceText: "Voor dit leerproject is al voortgang opgeslagen.",
      lastPosition: "Je laatste positie", startNew: "Opnieuw beginnen", continueLast: "Doorgaan vanaf de laatste positie",
      resettingProgress: "Voortgang wordt gereset …", resetProgressFailed: "De leervoortgang kon niet worden gereset.",
      ready: "gereed", running: "bezig", finished: "voltooid",
    },
  };

  function project(project, locale) {
    const translation = projects[locale]?.[project?.slug];
    if (!translation) return project;
    return { ...project, name: translation[0], description: translation[1] };
  }

  function text(locale, key, fallback = key) {
    return ui[locale]?.[key] || ui.de[key] || fallback;
  }

  return { project, text };
})();
