# Embedded-Runtime fuer Tamagotchi

Diese Runtime uebertraegt das Tamagotchi-Modell auf Embedded-Hardware, zum Beispiel ESP32.

Der generierte Code soll spaeter unter `generated/embedded/tamagotchi/` als separat linkbare Komponente liegen. Die Basissoftware bleibt unveraendert und ruft nur freigegebene Hooks auf.

Der Embedded-Pfad zeigt andere technische Randbedingungen als die Browser App:

- Geraetespeicher statt Browser-Speicher
- Build, Flash und OTA
- begrenzte Ressourcen
- echte Laufzeit auf Hardware
