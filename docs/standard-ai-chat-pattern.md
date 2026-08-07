# Standard-KI-Chat-Pattern

## Ziel

Alle KI-Chats der GerNetiX-Plattform vermitteln dasselbe Bedienmodell. Nutzer
muessen nicht je Arbeitsbereich neu lernen, wie eine Nachricht eingegeben,
abgesendet oder als laufend beziehungsweise fehlgeschlagen erkannt wird.

Das Pattern vereinheitlicht die Interaktion und die visuelle Grundstruktur.
Fachlicher Kontext, Berechtigungen, Provider, Persistenz, Quellenzugriff und
erlaubte Aktionen bleiben Verantwortung des jeweiligen Domaenencontrollers und
seines serverseitigen Endpunkts.

## Verbindliches Bedienversprechen

Jeder GerNetiX-KI-Chat bietet:

1. einen sichtbaren Nachrichtenverlauf mit unterscheidbaren Rollen,
2. eine Texteingabe mit automatisch wachsender Hoehe,
3. `Enter` zum Absenden,
4. `Shift+Enter` fuer einen Zeilenumbruch,
5. Schutz vor versehentlichem Absenden waehrend einer IME-Textkomposition,
6. einen runden Aufwaertspfeil innerhalb der Eingabebox,
7. eine zugaengliche Beschriftung des Pfeils per `aria-label` und `title`,
8. die sofortige Anzeige der eigenen Nachricht,
9. einen sichtbaren KI-Arbeitszustand,
10. eine gesperrte Eingabe, wenn der jeweilige Chat keine parallele Anfrage erlaubt,
11. eine im Verlauf verbleibende, klar markierte Fehlermeldung,
12. einen sichtbaren deaktivierten Zustand, wenn Konto, Entitlement oder fachlicher Kontext fehlen,
13. die garantierte Unterdrueckung nativer Formularnavigation, damit ein fehlender Domaenenhandler niemals die Seite neu laedt.

Ein Textelement mit der Beschriftung `Senden` ist in einem Standard-Composer
nicht vorgesehen. Der Pfeil ist die sichtbare Aktion; die zugaengliche
Beschriftung beschreibt weiterhin eindeutig `Nachricht senden` oder
`Frage senden`.

## Gemeinsamer technischer Vertrag

Die Verhaltensschicht liegt in
`services/identity-server/public/app/ai-chat-pattern.js`. Sie wird einmal vor
den Domaenencontrollern geladen und verwendet Event-Delegation, damit auch
dynamisch neu gerenderte Chats denselben Tastaturvertrag erhalten.

```html
<section class="ai-chat ai-chat--regular">
  <div class="ai-chat__messages" aria-live="polite">
    <article class="ai-chat__message assistant">...</article>
    <article class="ai-chat__message user">...</article>
  </div>
  <form class="ai-chat__composer" data-ai-chat-form>
    <span class="ai-chat__input-box">
      <textarea class="ai-chat__input" data-ai-chat-input></textarea>
      <button class="ai-chat__send" data-ai-chat-send
        type="submit" aria-label="Nachricht senden" title="Nachricht senden">
        &uarr;
      </button>
    </span>
  </form>
</section>
```

Pflichtklassen und Attribute:

| Element | Vertrag |
| --- | --- |
| Wurzel | `.ai-chat` plus genau eine Groessenvariante |
| Verlauf | `.ai-chat__messages` und `aria-live="polite"` |
| Nachricht | `.ai-chat__message` plus `.user` oder `.assistant` |
| Formular | `.ai-chat__composer` und `data-ai-chat-form` |
| Eingabebox | `.ai-chat__input-box` |
| Textarea | `.ai-chat__input` und `data-ai-chat-input` |
| Aktion | `.ai-chat__send`, `data-ai-chat-send`, `type="submit"`, `aria-label`, `title` |

## Groessenvarianten

Nur die Skalierung darf je Einbauort variieren:

| Variante | Einsatz | Unterschied |
| --- | --- | --- |
| `.ai-chat--compact` | Seitenleisten und IDE-Panels | kleinere Nachrichten, Pfeil und maximale Eingabehoehe |
| `.ai-chat--regular` | normale Inhaltsbereiche | Standardabstaende und Standard-Composer |
| `.ai-chat--large` | dominanter Arbeitsbereich wie der KI-Hardware-Assistent | groesserer Verlauf und besser lesbare Nachrichten |

Die Varianten werden ueber CSS Custom Properties definiert. Domaenen duerfen
keine eigene Sendetaste, abweichende Enter-Regel oder konkurrierende
Composer-Geometrie einfuehren. Domaenenspezifische Kopfbereiche,
Quellenhinweise, Usage-Anzeigen, Vorschlaege und Werkzeugaktionen bleiben
zulaessig.

Wenn ein Chat kosten- oder tokenbasierte KI verwendet, darf sein Kopfbereich
die kontoweite KI-Nutzung anzeigen. Der Domaenencontroller ergaenzt darunter
die Nutzung des letzten Aufrufs und aktualisiert den gemeinsamen Monatsstand
nach einer erfolgreichen Buchung. Der KI-Hardware-Assistent zeigt dafuer Eingabe-,
Antwort- und Gesamttokens sowie das verwendete Modell.

## Zustandsmodell

Nachrichten verwenden neben der Rolle folgende sichtbare Zustaende:

- `.is-pending`: Die Anfrage wurde angenommen; Text und animierte Punkte zeigen den aktuellen Arbeitsschritt.
- `.is-error`: Der Aufruf ist fehlgeschlagen oder wurde abgelehnt; die Meldung bleibt im Verlauf und wird mit einer roten Kontur markiert.
- ohne Zustandsklasse: Die Nachricht ist abgeschlossen.

Ein Verbindungsindikator beschreibt ausschliesslich die Erreichbarkeit des
Assistenten: bereit ist gruen, laufende Verarbeitung orange. Fachliche
Ablehnungen oder einzelne fehlgeschlagene Antworten faerben ihn nicht rot,
sondern erscheinen mit Erklaerung im Verlauf. Domaenen duerfen diese
behebbaren Hinweise statt rot auch orange darstellen.

Die eigene Nachricht wird vor dem Netzaufruf gerendert. Der
Domaenencontroller erzeugt danach eine ausstehende Assistentennachricht und
ersetzt genau diese bei Erfolg oder Fehler. Ausstehende Platzhalter werden
nicht als fachlicher Chatverlauf an den Server gesendet und nicht dauerhaft
persistiert.

## Verantwortungsgrenze

Das gemeinsame Pattern verantwortet:

- Tastaturbedienung,
- Schutz vor nativer Formularnavigation,
- automatische Eingabehoehe,
- Composer- und Pfeilgeometrie,
- Rollen- und Zustandsdarstellung,
- Skalierungsvarianten und Fokusdarstellung.

Der jeweilige Chat verantwortet weiterhin:

- Authentifizierung und Entitlements,
- serverseitige Autorisierung,
- AI-Usage-Preflight und Abrechnung,
- Provider- und Modellwahl,
- Kontextfreigaben,
- Persistenz und Conversation-ID,
- erlaubte Tools und Domaenenaktionen,
- fachliche Fehlertexte.

Die AI-Usage-Vorprüfung muss denselben begrenzten Kontext schätzen, der
tatsächlich an den Provider gesendet wird. Wenn ein Chat beispielsweise nur
die letzten Nachrichten überträgt, darf die Vorprüfung nicht den vollständigen
persistierten Verlauf ansetzen. Persistenz und Providerkontext bleiben dabei
getrennte Größen.

## Iterativer Fachkontext

Ein geführter Assistent arbeitet mit einer serverseitigen Fachakte und genau
einem aktuellen Schritt. Der sichtbare, persistierte Chatverlauf ist keine
automatische Provider-Eingabe. Ein KI-Aufruf erhält nur:

- den aktuellen Schritt und die eine offene Frage,
- die dafür notwendigen bestätigten Fakten,
- die aktuelle Antwort des Nutzers,
- wenige für diesen Schritt relevante Quellenreferenzen.

Die KI gibt ausschließlich geprüfte Änderungen, den nächsten Schritt und
höchstens eine nächste Frage zurück. Sie wiederholt weder die vollständige
Fachakte noch den Gesprächsverlauf. Der Server validiert und vereinigt die
Änderungen mit der kanonischen Fachakte. Erst ein serverseitig geprüftes
`completed` beendet die Einrichtung und öffnet nachfolgende Aktionen.

Der KI-Hardware-Assistent verwendet dieses Muster für Boardidentität,
Prozessor, Speicher, Ausstattung, belegte GPIO-Zuordnungen und die Vorbereitung
der Discovery-Prüfung. Unbestätigte GPIO-Möglichkeiten werden nicht als
umfangreiche Pin-Liste in jeden KI-Aufruf übernommen.

Das UI-Pattern ist deshalb keine neue KI-Runtime und keine neue Persistenzquelle.

## Aktuelle Verwendung

| Chat | Variante | Fachliche Verantwortung |
| --- | --- | --- |
| Architektur-KI der Entwicklungsplattform | compact | Projektziel, Anforderungen und Architektur |
| Code-Explorer in der IDE | compact | Projektquellen lesen und bestaetigungspflichtige Aenderungen vorschlagen |
| GerNetiX Help | regular | kostenkontrollierter OpenAI-Assistent, auf passende Hilfeartikel begrenzt |
| KI-Hardware-Assistent | large | Boardanalyse, Profilaufbau und sichere Discovery-Schritte |

Neue Plattform-KI-Chats muessen dieses Pattern verwenden. Eine Abweichung
benoetigt eine dokumentierte Architekturentscheidung; eine neue Farbe oder
eigene Sendelogik allein ist kein ausreichender Grund.

## Nachweis

`services/identity-server/test/standard-ai-chat-pattern.test.js` prueft den
gemeinsamen Tastaturvertrag, die einmalige Einbindung der Verhaltensschicht,
alle aktuellen Chat-Wurzeln, Groessenvarianten, Datenattribute,
Pfeilbeschriftungen und die Zustandsklassen. Die Domaenentests pruefen
zusaetzlich ihre jeweiligen API-, Berechtigungs- und Persistenzvertraege.
