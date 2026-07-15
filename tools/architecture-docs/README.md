# GerNetiX Architektur-Dokumentation

Eigenstaendige, offline nutzbare Browser-Lesesicht auf die vorhandene GerNetiX-Architekturdokumentation.

Die Anwendung fuehrt zusammen:

- bestaetigte Architekturentscheidungen aus dem SQLite-Graphen,
- gepflegte Markdown-Dokumente unter `docs/`,
- generierte Lesesichten unter `docs/generated/`,
- zentrale SVG-Diagramme,
- weitere und fruehere Dokumentationsansaetze als Rekonstruktionsarchiv.

Die Offline-Ausgabe ist keine neue fachliche Quelle der Wahrheit. Sie wird aus den bestehenden Quellen erzeugt.

## Erzeugen

```powershell
cd tools\architecture-docs
npm run build
```

Danach kann `dist/index.html` direkt im Browser geoeffnet werden. Ein Serverprozess ist nicht erforderlich.

## Test

```powershell
npm test
```
