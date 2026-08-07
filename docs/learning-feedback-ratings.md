# Bewertungen und Verbesserungsvorschlaege

## Ziel

Nutzer koennen abgeschlossene Lernprojekte, Projekt-Templates und eigene Entwicklungsprojekte anhand derselben vier Kriterien bewerten. Ein Lernprojekt fragt diese Bewertung genau einmal und ausschliesslich nach dem letzten abgeschlossenen Schritt ab. Templates und Entwicklungsprojekte bieten zusaetzlich einen eigenen Feedback-Knopf fuer konkrete Verbesserungsvorschlaege. Die zentrale Admin-Sicht macht wiederkehrende Staerken und Schwachstellen sichtbar, ohne das Admin Tool zur fachlichen Datenquelle zu machen.

## Bewertungsskalen

Jedes Kriterium verwendet eine Pflichtskala von 1 bis 5:

- `clarity`: 1 = unklar, 5 = sehr verstaendlich
- `fun`: 1 = wenig Spass, 5 = sehr viel Spass
- `difficulty`: 1 = sehr leicht, 5 = sehr schwierig
- `completeness`: 1 = lueckenhaft, 5 = vollstaendig

Ein Freitextkommentar bis 2.000 Zeichen ist optional. Die Schwierigkeit ist bewusst keine Gut-/Schlecht-Skala; ihr Mittelwert zeigt, wie anspruchsvoll Nutzer den Inhalt erleben.

Ein Verbesserungsvorschlag besteht aus einem verpflichtenden Freitext und enthaelt keine erzwungene Sternebewertung. Dadurch werden quantitative Bewertungen und konkrete Aenderungswuensche in derselben zentralen Sicht sichtbar, aber fachlich unterscheidbar gespeichert.

## Verantwortlichkeiten

- Die Plattform UI zeigt das Lernprojektformular erst, wenn der Project Server den vollstaendigen Projektfortschritt als `completed` gespeichert hat. Nach einer erfolgreichen Bewertung erscheint es fuer dieses accountgebundene Projekt nicht erneut.
- Der Identity Server prueft die aktive Sitzung und bei Projekten den Projektbesitz. Template-IDs muessen im serverseitigen Katalog vorkommen. Projekt-, Template- und Account-Zuordnung werden nicht aus frei uebermittelten Nutzerwerten uebernommen.
- Der Project Server validiert die vier Skalen, prueft den vollstaendigen Lernfortschritt und weist jede zweite Lernprojektbewertung desselben Accounts und Projekts ab. Er persistiert Projektfeedback in `project_feedback` sowie Template-Feedback in `project_template_feedback` in PostgreSQL als fachliche Wahrheit.
- Lernprojektfeedback enthaelt neben der accountgebundenen Projektinstanz die stabile `learning_project_id` und den Katalogtitel. Das Admin Tool gruppiert dadurch alle Instanzen desselben Lernprojekts, zeigt je Kriterium Mittelwert und Anzahl sowie die 1-bis-5-Verteilung aller vier Skalen. Es persistiert keine zweite fachliche Kopie.

## Datenschutz

Die Standardbewertung enthaelt keine Kontaktfreigabe. Account- und Kontaktdaten bleiben in der Admin-Sicht nach dem bestehenden zweckgebundenen Consent-/Rechtsgrundlagen- und Audit-Modell maskiert. Fuer spaetere Rueckfragen kann weiterhin ein feedbackspezifischer, zeitlich begrenzter Consent verwendet werden.

## Nachweis

- Project-Server-Tests fuer Projektabschluss, Einmaligkeit, vollstaendige 1-bis-5-Skalen, Template-Bewertungen und getrennte Verbesserungsvorschlaege
- Identity-Routentests fuer serverseitig abgeleiteten Account, geprueften Projektbesitz und Katalog-Templates
- Admin-UI-Vertragstest fuer Navigation, zentrale Sicht, Projekt-/Templatefilter und API-Abruf
