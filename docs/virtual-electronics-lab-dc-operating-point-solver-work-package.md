# ELAB-PAR-002: Deterministischer DC-Arbeitspunkt-Solver

Stand: 2026-08-16  
Status: umgesetzt und getestet (2026-08-16)

## 1. Ziel

Dieses Arbeitspaket implementiert den ersten wiederverwendbaren elektrischen
Solverkern des GerNetiX-Elektroniklabors. Er berechnet den linearen
Gleichstrom-Arbeitspunkt kleiner Lernschaltungen und bildet damit eine
technische Grundlage fuer spaetere Grundschaltungen, Sensorpfade und
SPICE-nahe Darstellungen.

Der Solver ist kein vollstaendiger SPICE-Ersatz. Er verspricht nur die in
diesem Paket ausdruecklich genannten linearen Funktionsmodelle.

## 2. Unabhaengigkeit

Das Paket darf keine Dateien der Durchstiche `ELAB-DS-001` bis `ELAB-DS-003`
aendern. Insbesondere bleiben die gemeinsame Laboroberflaeche, der virtuelle
Mikrocontroller, PWM, LED-Darstellung, Oszilloskop und bestehende Einzellabore
unveraendert.

Neue Dateien liegen ausschliesslich unter:

```text
modules/virtual-electronics-lab/learning-solver/
modules/virtual-electronics-lab/test/learning-solver/
```

Die fachliche Spezifikation liegt in diesem Dokument. Eine UI-Integration ist
ein spaeteres eigenes Arbeitspaket.

## 3. Enthaltener Umfang

Der Solver unterstuetzt genau:

- DC-Arbeitspunktanalyse,
- ideale Widerstaende,
- ideale Gleichspannungsquellen,
- ideale Gleichstromquellen,
- beliebige kleine lineare Netzwerke innerhalb fester Grenzen,
- Knotenspannungen gegen den expliziten Bezugsknoten,
- Zweigspannung, Zweigstrom und aufgenommene Leistung je Komponente,
- stabile Fehlercodes fuer ungueltige, schwebende, singulaere oder
  widerspruechliche Schaltungen,
- deterministische Ergebnisse unabhaengig von der Eingabereihenfolge.

Nicht enthalten sind:

- UI oder freie Verdrahtung,
- Mikrocontroller- oder Instrumentenanbindung,
- Transienten- oder AC-Analyse,
- Kondensatoren und Spulen,
- Dioden, LEDs, Transistoren oder andere nichtlineare Modelle,
- Temperatur- oder Toleranzmodelle,
- Raw-SPICE, Netlist-Import oder externe Solver,
- Persistenz, Netzwerkzugriff oder KI-Aufrufe.

## 4. Versionierter Eingabevertrag

Der Einstiegspunkt lautet:

```js
solveDcOperatingPoint(circuit)
```

Ein gueltiger Eingang besitzt folgende Form:

```js
{
  schemaVersion: "1.0.0",
  analysis: "dc-operating-point",
  groundNode: "0",
  components: [
    {
      id: "V1",
      type: "dc-voltage-source",
      positiveNode: "vcc",
      negativeNode: "0",
      voltageV: 5
    },
    {
      id: "R1",
      type: "resistor",
      fromNode: "vcc",
      toNode: "0",
      resistanceOhm: 1000
    }
  ]
}
```

Fuer eine Gleichstromquelle gelten `positiveNode`, `negativeNode` und
`currentA`. Ein positiver Strom fliesst definitionsgemaess von
`positiveNode` nach `negativeNode`.

Fuer einen Widerstand ist ein positiver Zweigstrom von `fromNode` nach
`toNode` definiert. Bei einer Spannungsquelle ist der positive Zweigstrom von
`positiveNode` nach `negativeNode` definiert.

## 5. Ergebnisvertrag

Ein erfolgreiches Ergebnis enthaelt mindestens:

```js
{
  ok: true,
  schemaVersion: "1.0.0",
  analysis: "dc-operating-point",
  groundNode: "0",
  nodeVoltages: [
    { nodeId: "0", voltageV: 0 },
    { nodeId: "vcc", voltageV: 5 }
  ],
  branches: [
    {
      componentId: "R1",
      componentType: "resistor",
      voltageV: 5,
      currentA: 0.005,
      powerW: 0.025
    }
  ],
  diagnostics: {
    solver: "deterministic-linear-mna",
    modelVersion: "1.0.0"
  }
}
```

`powerW` verwendet die passive Vorzeichenkonvention. Ein positiver Wert
bedeutet Leistungsaufnahme, ein negativer Wert Leistungsabgabe.

Knoten und Zweige werden stabil sortiert. Der Bezugsknoten steht bei den
Knotenspannungen immer zuerst.

## 6. Berechnungsverfahren

Die Berechnung verwendet Modified Nodal Analysis (MNA):

- Widerstaende werden als Leitwerte in die Knotenmatrix gestempelt.
- Gleichstromquellen werden in den rechten Stromvektor gestempelt.
- Ideale Spannungsquellen erweitern das Gleichungssystem um ihren Zweigstrom.
- Das lineare System wird ohne externe Bibliothek mit skalierter
  Pivotisierung geloest.

Die interne Komponenten- und Knotenreihenfolge wird vor dem Stempeln
kanonisch sortiert. Die Berechnung darf nicht von Objekt- oder
Eingabereihenfolgen abhaengen.

## 7. Harte Grenzen

- maximal 64 Komponenten,
- maximal 32 Knoten einschliesslich Bezugsknoten,
- Komponenten- und Knoten-IDs sind nichtleere kontrollzeichenfreie Strings
  mit maximal 64 Zeichen,
- Widerstand: groesser oder gleich `1e-6 Ohm` und kleiner oder gleich
  `1e12 Ohm`,
- Betrag einer Quellenspannung: maximal `1e6 V`,
- Betrag eines Quellenstroms: maximal `1e3 A`,
- alle Zahlen muessen endlich sein.

Diese Grenzen sind Schutz- und Modellgrenzen. Sie sind kein Versprechen, dass
jede mathematisch extrem schlecht konditionierte Schaltung innerhalb dieser
Werte sinnvoll simuliert werden kann.

## 8. Fehlervertrag

Fehler werden als `ok: false` mit einem stabilen `errors`-Array geliefert.
Mindestens folgende Codes sind vorgesehen:

- `INVALID_CIRCUIT`
- `UNSUPPORTED_SCHEMA_VERSION`
- `UNSUPPORTED_ANALYSIS`
- `COMPONENT_LIMIT_EXCEEDED`
- `NODE_LIMIT_EXCEEDED`
- `INVALID_COMPONENT_ID`
- `DUPLICATE_COMPONENT_ID`
- `UNSUPPORTED_COMPONENT_TYPE`
- `INVALID_NODE_ID`
- `SELF_CONNECTED_COMPONENT`
- `INVALID_COMPONENT_PARAMETER`
- `GROUND_NODE_NOT_CONNECTED`
- `FLOATING_NODE`
- `INCONSISTENT_CIRCUIT`
- `SINGULAR_CIRCUIT`
- `NUMERICAL_FAILURE`

Fehlertexte sind Diagnosehilfen, aber keine stabile Programmierschnittstelle.
Aufrufer werten den Code und strukturierte Zusatzfelder aus.

## 9. Abnahmekriterien

Das Paket ist abgeschlossen, wenn automatisierte Tests mindestens belegen:

1. Spannungsteiler mit korrekten Knotenwerten, Stroemen und Leistungen,
2. Schaltung mit Gleichstromquelle,
3. Netzwerk mit mehreren Spannungsquellen,
4. Leistungsbilanz innerhalb numerischer Toleranz,
5. identisches Ergebnis bei umgekehrter Komponentenreihenfolge,
6. Ablehnung doppelter IDs und ungueltiger Parameter,
7. Erkennung eines nicht geerdeten Knotens,
8. Erkennung widerspruechlicher idealer Spannungsquellen,
9. Erkennung eines singulaeren Systems mit redundanten Quellen,
10. Einhaltung der Komponenten- und Knotengrenzen.

## 10. Folgepakete

Moegliche spaetere Pakete sind bewusst nicht Teil dieser Umsetzung:

- Adapter vom `LabProject` zum DC-Solververtrag,
- Widerstandsnetzwerk als freie Laborvorlage,
- PT1000-Modell -> Widerstand -> DC-Solver -> ADC,
- linearisierte Bauteilmodelle,
- SPICE-Adapter und Netlist-Export,
- Transientenanalyse mit virtueller Zeit.
