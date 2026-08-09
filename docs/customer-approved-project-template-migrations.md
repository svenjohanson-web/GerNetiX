# Kundenzustimmung für Entwicklungsprojekt-Template-Migrationen

Bestehende Entwicklungsprojekte werden beim Auflisten, Öffnen oder Lesen niemals automatisch an eine neuere Entwicklungsprojekt-Template-Version angepasst. Normale Lesewege dürfen keine solche Migration ausführen und dadurch weder Projektmetadaten noch Projektdateien verändern.

Die früher vorgesehene Aktualisierung älterer Projekte des Templates `esp32_camera_to_touch_display` bleibt ausschließlich als fachliche Idee und als Sammlung reiner, nicht angebundener Transformationen erhalten. Sie wird nicht von der Identity-Runtime ausgeführt.

## Voraussetzung für eine spätere Umsetzung

Eine spätere Migration benötigt einen eigenen, versionierten Ablauf mit:

1. account- und projektgebundener Berechtigungsprüfung,
2. unveränderlicher Ausgangsversion und wiederherstellbarem Snapshot,
3. rein lesendem Plan mit vollständiger Datei- und Modelldifferenz,
4. ausdrücklicher Kundenzustimmung für genau diese Version und diesen Plan,
5. getrenntem Apply-Schritt mit Konfliktprüfung,
6. Audit-Eintrag mit Zustimmung, Quellversion, Zielversion und Ergebnis,
7. nachvollziehbarem Rollback ohne Verlust späterer Kundenänderungen.

Eine Zustimmung darf weder aus dem Öffnen eines Projekts noch aus einer allgemeinen AGB-, Account- oder Administrationsfreigabe abgeleitet werden. Ändert sich der Migrationsplan nach der Vorschau, ist eine neue Zustimmung erforderlich.

## Aufbewahrte Transformationsidee

Die nicht angebundenen Kandidaten in `services/identity-server/src/dev/development-project-template-migrations.js` beschreiben derzeit nur:

- die Aufteilung einer alten direkten Kamera-Display-Beziehung in getrennte WLAN-Schnittstellen im bekannten PlantUML-Muster,
- die Typisierung bestimmter historischer Display-GPIO-Zuweisungen für ESP-IDF.

Diese Funktionen verändern keine Persistenz und besitzen bewusst keinen Route-, Bootstrap-, Projektlade- oder Projektöffnungs-Aufrufer.
