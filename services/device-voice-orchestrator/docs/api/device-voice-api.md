# Device Voice Sessions API

Prefix: `/api/device-voice`

## Capabilities

`GET /api/device-voice/capabilities` meldet Verfuegbarkeit, Audioformat, Zeitgrenze und Retention-Regeln. `available=false` ist der sichere Standardzustand.

## Session anlegen

`POST /api/device-voice/sessions`

JSON-Felder: `device_id`, `challenge_id`, `signature`. Challenge und ECDSA-Signatur stammen aus dem bestehenden Device-Management-Vertrag. Device Management leitet den freigebenden Account serverseitig ab; eine Account-ID wird nicht vom Device vertraut. Die Session wird nur nach eindeutiger Account-Zuordnung, aktiver Voice-AI-Freigabe und AI-Usage-Preflight angelegt.

Die Antwort enthaelt einen einmal sichtbaren `session_token`, eine kurze Ablaufzeit und `maximum_audio_bytes`. Serverseitig wird nur der SHA-256-Hash des Tokens fluechtig gehalten.

## Aufnahme verarbeiten

`POST /api/device-voice/sessions/{sessionId}/audio`

- `Authorization: Bearer {session_token}`
- `Content-Type: audio/L16;rate=16000;channels=1`
- Body: PCM16 mono, maximal die fuer die Session gemeldete Groesse

Bei Erfolg ist der Body unmittelbar die Audioantwort. `Cache-Control: no-store` verhindert Caching. Die Session ist danach verbraucht, auch bei einem Providerfehler. Weder Rohaufnahme noch Transkript werden persistiert.
