# GerNetiX Mobile Demo

Klickbarer React-Native-/Expo-Prototyp fuer iOS und Android. Die App verwendet
bewusst lokale Beispieldaten und greift nicht auf Konten, Projekte oder
persistierte Telemetrie zu.

## Auf dem Smartphone testen

1. Auf dem iPhone oder Android-Handy **Expo Go** installieren.
2. In diesem Verzeichnis `npm install` ausfuehren.
3. `npm start` ausfuehren.
4. Den angezeigten QR-Code mit der Kamera (iOS) beziehungsweise Expo Go
   (Android) scannen.

Falls auf einem iPhone eine andere App das `exp://`-Linkschema beansprucht,
kann derselbe React-Native-Prototyp ueber die vom Expo-Entwicklungsserver
bereitgestellte Safari-Vorschau geoeffnet werden. Das ist nur ein
Besichtigungsweg und keine Entscheidung fuer eine PWA als Produkt.

Die eigenstaendige Safari-Vorschau wird mit `expo export --platform web
--output-dir dist-web` gebaut und danach mit `npm run preview` auf Port 8082
bereitgestellt. Dadurch wird nicht versehentlich das technische Expo-Manifest
als Text angezeigt.

Expo Go dient hier nur dem UI-Prototyp. Eine spaetere produktive App verwendet
einen eigenen Development Build und native App-Store-Builds.

## Enthaltene Ansichten

- persoenliches Telemetrie-Dashboard
- simulierter Live-Status
- Geraeteuebersicht
- Alarmregeln
- Dashboard-Bearbeitung

Die spaetere Serveranbindung muss ueber authentifizierte, account-, projekt-
und geraetegebundene APIs erfolgen. Der lokale Zustand dieser Demo ist keine
fachliche Quelle der Wahrheit.
