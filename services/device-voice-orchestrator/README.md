# Device Voice Orchestrator

Sicherer, providerneutraler Plattformunterbau fuer kurze Voice-AI-Sitzungen von gekoppelten GerNetiX-Devices. Der Dienst kennt weder Nexi noch Eltern- oder Kinderprofile. Verhalten und Grenzen stammen aus einer serverseitig autorisierten Assistentendefinition.

- Das Device fordert eine Session fuer ein konkretes Projekt, einen Assistenten, eine Instanz, einen Modus und genau eine unveraenderliche Revision an.
- Device Management prueft ECDSA-Challenge, Account-Zuordnung, Projekt-/Assistentenbindung und die Freigabe. Vom Device gesendete Assistentenregeln werden nicht vertraut.
- AI Usage genehmigt und verbucht jeden externen Aufruf.
- Eingabe ist mono PCM16 mit 16 kHz und maximal 15 Sekunden.
- Session, aufgeloeste Assistentenkonfiguration und Rohaufnahme bleiben fluechtig; Transkripte, Werkzeugergebnisse und Antworttext werden nicht persistiert oder an das Device geliefert.
- Device- und Account-Rate-Limits bremsen Missbrauch bereits vor weiteren AI-Usage-Ereignissen.
- `disabled` ist der sichere Standard. `fake` durchlaeuft deterministisch die produktionsnahe STT-LLM-TTS-Pipeline ohne Netzwerkzugriff oder Cloudkosten.

## Providervertrag

`OrchestratedVoiceProvider` trennt vier Grenzen:

1. `speechToText.transcribe(...)`
2. `languageModel.generate(...)`
3. optionale, explizit erlaubte `tools[tool_id].execute(...)`
4. `textToSpeech.synthesize(...)`

Werkzeuge muessen gleichzeitig in der Assistenten-Policy erlaubt und im Server registriert sein. Pro Aufnahme ist hoechstens eine begrenzte Werkzeugrunde moeglich. Jede LLM-Antwort muss eine positive Safety-Entscheidung enthalten; andernfalls wird die AI-Usage-Buchung als Fehler geschlossen.

Ein spaeterer OpenAI-Adapter implementiert diese Grenzen, ohne den Session-, Authentifizierungs-, Retention- oder Kostenvertrag zu veraendern.

## Lokale Providerwahl

- `DEVICE_VOICE_PROVIDER=disabled` (Standard)
- `DEVICE_VOICE_PROVIDER=fake` (nur Entwicklung und Contract-Tests)

Siehe [API-Vertrag](docs/api/device-voice-api.md).
