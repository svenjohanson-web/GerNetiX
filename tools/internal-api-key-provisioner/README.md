# Interne API-Key-Provisionierung

Dieses lokale Werkzeug erzeugt fuer die fest kodierte Allowlist interner
GerNetiX-Aussteller je ein Ed25519-Schluesselpaar. Es schreibt private Keys als
Base64-kodiertes PKCS8-DER in getrennte Dateien und erzeugt einen oeffentlichen
Trust-Ring mit Base64-kodierten SPKI-DER-Public-Keys.

Das Ziel muss ausserhalb des Repositorys liegen und darf entweder noch nicht
existieren oder muss leer sein:

```shell
npm run provision -- --output /secure/gernetix/internal-api-keys-2026-09 --version 2026-09
```

Fuer eine Rotation wird der bisherige oeffentliche Ring kontrolliert in den
neuen Ring uebernommen:

```shell
npm run provision -- --output /secure/gernetix/internal-api-keys-2026-10 --version 2026-10 --previous-trust-ring /secure/gernetix/internal-api-keys-2026-09/public-trust-ring.json
```

Der erzeugte Ring enthaelt dann alte und neue Public Keys. Nach Umstellung
aller Aussteller und Ablauf der maximalen Token-Lebensdauer wird die alte
Generation aus dem verteilten Ring entfernt. Private Keys werden nie
zusammengefuehrt oder an andere Dienste verteilt.

Private Dateien und Manifest/Rotationshinweise werden mit Modus `0600`, das
Private-Unterverzeichnis und Ziel mit `0700` angelegt. Auf Windows bleiben
zusaetzlich die NTFS-Berechtigungen des Zielorts massgeblich. Private
Schluesselwerte werden nie auf stdout geschrieben.

Die erzeugten Dateien sind Deployment-Secrets und duerfen nicht in Git
aufgenommen werden. Nur `public-trust-ring.json` ist zur Verteilung an
pruefende Dienste bestimmt. Jedem ausstellenden Dienst wird ausschliesslich
seine eigene Datei aus `private/` bereitgestellt.

## Vorhandene Konfiguration pruefen

```shell
node index.js --verify-env /opt/gernetix/.env.vps
```

Der Pruefmodus liest eine bereits verteilte Konfiguration und bestaetigt fuer
jeden Aussteller, dass die Key-ID im oeffentlichen Trust-Ring enthalten ist, der
private Schluessel ein lesbares Ed25519-PKCS8-DER ist und beide ueber eine
Signaturprobe tatsaechlich zusammengehoeren. Ein vorhandener, aber ungueltiger
Platzhalter gilt ausdruecklich als Fehler. Ausgegeben werden nur Anzahl und
Ausstellername; Schluesselwerte erscheinen nie in der Ausgabe.

Das Staging-Deployment ruft diesen Modus bei vollstaendig konfiguriertem
Bestand automatisch auf und bricht bei einem ungueltigen Satz ab. Es erzeugt
dabei niemals Ersatzschluessel: Eine Rotation bleibt ein ausdruecklicher,
getrennter Lauf mit `--output` und `--version` samt kontrollierter Verteilung.
Pruef- und Erzeugungsmodus schliessen sich gegenseitig aus.
