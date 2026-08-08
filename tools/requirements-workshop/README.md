# Anforderungswerkstatt

Die Anforderungswerkstatt ist ein kostenloses, browserbasiertes Lernprojekt fuer Requirements Engineering in deutscher Sprache. Am Praxisfall „Zugang an einer Maschine“ lernt der Nutzer, seine Absicht so zu beschreiben, dass eine umsetzende KI moeglichst wenig still annehmen muss.

## Lernziele

- eine KI-Interpretation von der eigenen Absicht unterscheiden,
- Identifikation, Authentifizierung, Autorisierung und Sitzung trennen,
- Fachwissen zu RFID, Passkey, PKI, Token, PIN und mehreren Faktoren aufbauen,
- funktionale Anforderungen, nicht-funktionale Anforderungen, Randbedingungen und fachliche Regeln unterscheiden,
- unpruefbare Begriffe, fehlende Fehlerfaelle und vorschnelle Technikvorgaben erkennen,
- Akzeptanzkriterien und offene Fragen sichtbar dokumentieren.

## Ablauf

1. freien ersten Vorschlag schreiben,
2. lokalen KI-Verstaendnisspiegel pruefen,
3. Annahmen uebernehmen, aendern oder offenlassen,
4. Einsatzkontext und moegliche Authentifizierungsverfahren erkunden,
5. Anforderungsarten in einer Klickuebung zuordnen,
6. typische Fallen anhand von Rueckfragen bearbeiten,
7. ein strukturiertes Anforderungspaket erzeugen und den Lernstand auswerten.

## Lokaler KI-Lernmodus

Der erste Stand verwendet eine deterministische, getestete Auswertung direkt im Browser. Sie erkennt fuer die Lektion relevante Begriffe und Luecken, uebertraegt keine Eingaben und macht ihre Regeln nachvollziehbar. Sie gibt sich nicht als allgemein intelligentes Sprachmodell aus. Der Lernablauf ist so getrennt, dass spaeter ein zentral freigegebener GerNetiX-KI-Adapter denselben Verstaendnisspiegel liefern kann.

Browser-State wird nur fuer die aktuelle, fluechtige Lektion verwendet und ist keine fachliche Persistenzquelle.

## Start

Die `index.html` kann direkt im Browser geoeffnet werden. Alternativ:

```text
cd tools/requirements-workshop
npm start
```

Danach ist die Anwendung unter `http://127.0.0.1:4325` erreichbar. Ein anderer Port kann bewusst mit `PORT` gesetzt werden.

## Test

```text
npm test
```

Die Tests pruefen Verstaendnisspiegel, Fachbegriffe, Anforderungsarten, Spezifikation und Lernbewertung ohne externen KI-Aufruf.
