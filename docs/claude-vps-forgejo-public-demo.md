# Claude-Arbeitsanweisung: Forgejo und Public-Demo-Veroeffentlichung

## Sicherheitsgrenze

Private Signierschluessel bleiben immer im jeweiligen Dienstcontainer auf dem
VPS. Claude darf weder `.env.vps` auslesen noch Schluessel per SSH, Datei,
Zwischenablage, Umgebungsvariable oder Befehlsargument auf den lokalen Rechner
uebertragen. Eine lokale Schluesselkopie wird auch dann nicht zulaessig, wenn sie
anschliessend geloescht werden soll.

## Forgejo vorbereiten

1. WireGuard aktivieren.
2. Im GerNetiX-Infrastrukturrepository den privaten Tunnel starten:

   ```text
   node tools/connect-staging.js
   ```

3. Im getrennten Checkout
   `C:\Users\sven_\Desktop\GerNetiX-Projekte\spielesammlung-esp32-s3-touch`
   arbeiten.
4. Vor Aenderungen `git status --short --branch` und `git pull --ff-only`
   ausfuehren.
5. Nur beabsichtigte Dateien committen und den vorhandenen Branch zu Forgejo
   pushen. Kein Force-Push und kein Token in der Remote-URL.

## Firmware bauen und abnehmen

Die Firmware im Produkt-Checkout ueber den vorhandenen Einstieg bauen:

```text
build.bat
```

Eine Veroeffentlichung ist erst erlaubt, nachdem Build, USB-Flash und die
Touch-Bedienung auf der echten Zielhardware erfolgreich geprueft wurden. Der
Produkt-Checkout muss sauber sein und `HEAD` muss seinem Forgejo-Upstream
entsprechen.

## Veroeffentlichung vorbereiten

Im GerNetiX-Infrastrukturrepository zuerst ausschliesslich den Dry-run
ausfuehren:

```text
node tools/publish-touch-spielesammlung-demo.js --dry-run
```

Der Dry-run prueft Forgejo-Commit, Arbeitsbaum und Build-Artefakte und zeigt nur
Metadaten, Dateigroessen, Offsets und Pruefsummen. Base64-Inhalte und Secrets
werden nicht ausgegeben.

Wenn der serverseitige Publisher auf dem VPS noch nicht vorhanden ist, muss
dieser GerNetiX-Infrastrukturstand zuerst nach dem normalen Verfahren getestet,
committed, gepusht und nach ausdruecklicher Freigabe deployed werden:

```text
node tools/verify-staging-runtime.js
node tools/staging-deploy.js --plan
node tools/staging-deploy.js
```

Das echte Deployment darf nur nach ausdruecklicher Nutzerfreigabe erfolgen.

## Demo veroeffentlichen

Nach erfolgreichem Dry-run und ausdruecklicher Freigabe genau diesen Befehl
verwenden:

```text
node tools/publish-touch-spielesammlung-demo.js --publish
```

Das Werkzeug streamt den Release-Payload ueber den fest konfigurierten privaten
SSH-Weg zum VPS. Der Identity-Container erzeugt dort ein kurzlebiges Token mit
Audience `public-demo-server` und Scope `public_demo.publish`. Der private
Identity-Schluessel verlaesst den Container nicht.

## Verbotene Ausweichwege

- Kein `grep` oder `cat` gegen `.env.vps`.
- Kein Lesen oder Kopieren von `*_PRIVATE_KEY_*`.
- Keine lokalen Signierschluessel in Umgebungsvariablen.
- Kein manueller POST auf den internen Public-Demo-Endpunkt.
- Kein direktes `docker compose exec` durch Claude.
- Keine breite Berechtigung wie `ssh gernetix-vps*` in Claude Settings.
- Kein mehrfaches Umformulieren oder Aufteilen eines blockierten Secret-Aufrufs.

Wenn der kontrollierte Publisher fehlschlaegt, ist die erste konkrete
Fehlermeldung zu melden. Claude darf dann keinen weniger sicheren Ersatzweg
verwenden.
