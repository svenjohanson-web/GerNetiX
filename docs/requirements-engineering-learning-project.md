# Lernprojekt fuer KI-verstaendliche Anforderungen

## Ziel

Die Anforderungswerkstatt vermittelt Requirements Engineering nicht als reine Schreibtechnik. Nutzer lernen, dass eine gute Anforderung sowohl eindeutige Sprache als auch ausreichendes Fachwissen braucht. Die leitende Qualitaetsfrage lautet:

> Wie viel muss eine umsetzende KI noch selbst annehmen?

Der erste vollstaendige Lernpfad verwendet die Anmeldung eines Mitarbeiters an einer Maschine. Der Fall ist bewusst fachlich offen: Benutzername und Passwort sind kein stiller Standard. RFID, Chipkarte, Passkey, Token, PKI, PIN und Mehrfaktorverfahren werden als unterschiedliche Moeglichkeiten mit eigenen Betriebs-, Sicherheits- und Lebenszyklusfragen behandelt.

## Didaktischer Ablauf

1. Der Nutzer formuliert einen freien ersten Vorschlag.
2. Der Verstaendnisspiegel trennt sicher Verstandenes, Annahmen und offene Fragen.
3. Der Nutzer entscheidet jede Annahme bewusst oder laesst sie sichtbar offen.
4. Wissenskarten trennen Identifikation, Authentifizierung, Autorisierung und Sitzung.
5. Einsatzkontext und Risiken werden durch Klickentscheidungen konkretisiert.
6. Eine Verfahrenslandkarte erklaert wichtige Authentifizierungsoptionen ohne eine davon pauschal als beste Loesung zu behaupten.
7. Aussagen werden als funktionale Anforderung, NFR, Randbedingung oder fachliche Regel eingeordnet.
8. Typische Fallen trainieren messbare Begriffe, zielorientierte Technikentscheidungen und Fehlerfaelle.
9. Aus den Entscheidungen entsteht eine gegliederte Spezifikation mit Akzeptanzkriterien und offenen Fragen.
10. Die Abschlussauswertung bewertet die bearbeiteten Lernaufgaben, nicht die vermeintliche Intelligenz oder Eignung des Nutzers.

## Fachliche Trennung

| Kategorie | Leitfrage | Beispiel |
| --- | --- | --- |
| Funktionale Anforderung | Was muss das System tun? | Einen Nachweis pruefen und Zugang gewaehren oder verweigern. |
| Nicht-funktionale Anforderung | Wie gut oder unter welcher Bedingung? | Die Pruefung muss in 500 Millisekunden und acht Stunden offline funktionieren. |
| Randbedingung | Welche Vorgabe begrenzt die Loesung? | Vorhandene RFID-Firmenausweise muessen nutzbar sein. |
| Fachliche Regel | Welche Regel des Anwendungsbereichs gilt? | Nur die Rolle Wartung darf den Servicemodus verwenden. |
| Offene Frage | Was wurde noch nicht entschieden? | Wie schnell muss eine Sperrung offline wirksam werden? |

Sicherheitsanforderungen werden nicht pauschal als NFR behandelt. Eine Sperrreaktion nach drei falschen PIN-Eingaben ist funktionales Verhalten; das allgemeine Schutzziel oder eine geforderte Widerstandsfaehigkeit kann dagegen nicht-funktional sein.

## Plattformintegration und Offline-Modus

Der primaere Lernweg ist in die angemeldete GerNetiX-Plattform unter
`/app/requirements-workshop/` integriert. Der Browser sendet einen freien
Anforderungsvorschlag an
`POST /api/platform/requirements-workshop/feedback`. Identity leitet die
Account-ID ausschliesslich aus der serverseitigen Sitzung ab, fuehrt vor dem
Provideraufruf einen AI-Usage-Preflight aus und bucht danach die tatsaechlichen
Tokens oder den Fehler. Der OpenAI-Responses-Aufruf verwendet `store: false`,
einen pseudonymisierten Safety-Identifier und ein striktes JSON-Schema. Die
Antwort wird serverseitig begrenzt und als Verstaendnisspiegel dargestellt.

Eingabe und Auswertung werden in diesem Stand nicht als fachlicher Lernstand
persistiert. Der Browser erhaelt keinen Provider-Schluessel und darf weder
Account-ID noch Nutzungsstatus vorgeben. Der lokale Stand unter
`tools/requirements-workshop` bleibt als kostenloser, reproduzierbarer und
offline-faehiger Lernpfad erhalten. Er ist bewusst als lokaler Lernmodus
gekennzeichnet und ersetzt nicht das echte KI-Feedback der Plattform.

## Nachweis

- Contract-Tests pruefen Structured Output, pseudonymisierte Providerkennung,
  serverseitige Accountableitung sowie Preflight- und Tokenabschlussbuchung.
- UI-Vertragstests pruefen das gemeinsame KI-Chat-Muster einschliesslich
  Enter, Shift+Enter, Pending- und Fehlerzustand.
- Die Offline-Browseranwendung kann direkt aus `index.html` oder ueber den
  kleinen lokalen Server gestartet werden; ihre deterministischen Tests
  pruefen Auswertung, Klassifikation, Spezifikation und Abschlussbewertung.
- Beide Varianten speichern in diesem Stand keinen fachlichen Lernstand.
