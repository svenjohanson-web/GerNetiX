# Device Voice Orchestrator

Sicherer, providerneutraler MVP-Unterbau fuer kurze Voice-AI-Sitzungen von gekoppelten GerNetiX-Devices.

- Device Management prueft ECDSA-Challenge, Account-Zuordnung und ausdrueckliche Elternfreigabe.
- AI Usage genehmigt und verbucht jeden externen Aufruf.
- Eingabe ist mono PCM16 mit 16 kHz und maximal 15 Sekunden.
- Session und Rohaufnahme bleiben fluechtig; Transkripte werden nicht persistiert oder an das Device geliefert.
- Device- und Account-Rate-Limits bremsen Missbrauch bereits vor weiteren AI-Usage-Ereignissen.
- Der einzige mitgelieferte Provider ist `disabled`. Dadurch kann ohne bewusst implementierte und freigegebene Providerintegration keine Sprache das System verlassen.

Siehe [API-Vertrag](docs/api/device-voice-api.md).
