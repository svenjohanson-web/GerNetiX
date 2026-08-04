# Device Voice Sessions API

Prefix: `/api/device-voice`

## Capabilities

`GET /api/device-voice/capabilities` meldet Verfuegbarkeit, Audioformat, Zeitgrenze, Retention-Regeln und den aktiven Providervertrag. `available=false` ist der sichere Standardzustand.

## Session anlegen

`POST /api/device-voice/sessions`

JSON-Felder:

- `device_id`, `challenge_id`, `signature`
- `project_id`
- genau eines von `project_commit` oder `assistant_revision`
- `assistant_definition_id`
- `assistant_instance_id`
- `mode_id`

Challenge und Signatur stammen aus dem bestehenden Device-Management-Vertrag. Device Management leitet den freigebenden Account serverseitig ab; eine Account-ID wird nicht vom Device vertraut. Der Orchestrator sendet den angeforderten Assistentenkontext an Device Management und akzeptiert die Session nur, wenn dessen Antwort alle Felder exakt bestaetigt.

Device Management muss zusaetzlich eine serverseitig aufgeloeste Konfiguration liefern:

```json
{
  "assistant_context": {
    "project_id": "project-123",
    "project_commit": "abcdef1234567890",
    "assistant_revision": null,
    "assistant_definition_id": "assistant-nexi",
    "assistant_instance_id": "instance-1",
    "mode_id": "knowledge"
  },
  "assistant_policy": {
    "locale": "de-DE",
    "safety_profile_id": "platform.safe.general-v1",
    "maximum_recording_seconds": 15,
    "maximum_reply_seconds": 20,
    "allowed_tool_ids": ["controlled_web_search"],
    "maximum_tool_calls": 1
  },
  "assistant_runtime": {
    "system_instruction": "...",
    "mode_instruction": "...",
    "provider_inputs": {
      "speech_to_text": {},
      "language_model": {},
      "text_to_speech": {}
    }
  }
}
```

Policy, Runtime und Provider-Eingaben aus dem Device-Request werden ignoriert. Identifier, Texte, Groessen, Locale, Werkzeugfreigaben und JSON-Providerparameter werden im Orchestrator erneut begrenzt und validiert. Die Session wird erst danach und nach erfolgreichem AI-Usage-Preflight angelegt.

Die Antwort enthaelt einen einmal sichtbaren `session_token`, eine kurze Ablaufzeit, `maximum_audio_bytes` und die bestaetigte `assistant_context`-Bindung. Serverseitig wird nur der SHA-256-Hash des Tokens fluechtig gehalten.

## Aufnahme verarbeiten

`POST /api/device-voice/sessions/{sessionId}/audio`

- `Authorization: Bearer {session_token}`
- `Content-Type: audio/L16;rate=16000;channels=1`
- Body: PCM16 mono, maximal die fuer die Session gemeldete Groesse

Bei Erfolg ist der Body unmittelbar die begrenzte PCM16-Audioantwort im Eingabeformat. `Cache-Control: no-store` verhindert Caching. Die Session ist danach verbraucht, auch bei einem Providerfehler. Weder Rohaufnahme noch Transkript, Werkzeugresultat oder Antworttext werden persistiert.

## Provider- und Tool-Grenzen

Der interne Vertrag `stt_llm_tools_tts_v1` verarbeitet eine Aufnahme in getrennten STT-, LLM-, Tool- und TTS-Stufen. Ein Tool-Aufruf wird nur ausgefuehrt, wenn die Policy dessen ID erlaubt und der Server einen Adapter fuer dieselbe ID registriert hat. Es gibt maximal eine Werkzeugrunde. Fehlende Safety-Entscheidung, nicht erlaubte Tools, fehlender Antworttext oder fehlendes Audio schliessen die Session und das AI-Usage-Ereignis als Fehler.

`DEVICE_VOICE_PROVIDER=fake` stellt eine deterministische, netzwerkfreie Testpipeline bereit. Der Standard `disabled` lehnt Sessions vor Device-Management- und AI-Usage-Aufrufen ab.
