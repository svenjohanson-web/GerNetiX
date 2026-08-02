# Systemprojekt Provisioning

Dieses interne Hintergrundprojekt ist die konkrete Projekterweiterung fuer
generische GerNetiX-Factory- und Provisioning-Firmware. Die geschuetzte
Basissoftware bleibt unter `basissoftware/esp32/`; sie wird nicht hierher
kopiert.

Direkte Factory-Builds der Basissoftware waehlen dieses Projekt ueber
`GERNETIX_PROJECT_SOURCE_DIR`. Dadurch wird auch Provisioning-Firmware immer
ueber denselben Erweiterungsvertrag gebaut wie ein accountgebundenes Projekt:

- fachlicher Einstieg: `Komponenten/Provisioning/src/user_main.cpp`
- technischer BuildPackage-Einstieg: `src/user/user_app.cpp`
- stabile Aufrufe: `userMain()` und `userTick()` ueber die geschuetzten Hooks

Die eigentlichen Provisioning-, WLAN-, Device-Identity- und OTA-Ablaufe bleiben
Bestandteil der Basissoftware. Dieses Projekt darf sie weder ersetzen noch
duplizieren; es schliesst den Projektvertrag fuer das generische Factory-Image.
