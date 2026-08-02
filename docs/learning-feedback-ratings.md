# Bewertungen und Verbesserungsvorschlaege

## Ziel

Nutzer koennen Lernprojekte, Projekt-Templates und eigene Entwicklungsprojekte anhand derselben vier Kriterien bewerten. Templates und Entwicklungsprojekte bieten zusaetzlich einen eigenen Feedback-Knopf fuer konkrete Verbesserungsvorschlaege. Die zentrale Admin-Sicht macht wiederkehrende Staerken und Schwachstellen sichtbar, ohne das Admin Tool zur fachlichen Datenquelle zu machen.

## Bewertungsskalen

Jedes Kriterium verwendet eine Pflichtskala von 1 bis 5:

- `clarity`: 1 = unklar, 5 = sehr verstaendlich
- `fun`: 1 = wenig Spass, 5 = sehr viel Spass
- `difficulty`: 1 = sehr leicht, 5 = sehr schwierig
- `completeness`: 1 = lueckenhaft, 5 = vollstaendig

Ein Freitextkommentar bis 2.000 Zeichen ist optional. Die Schwierigkeit ist bewusst keine Gut-/Schlecht-Skala; ihr Mittelwert zeigt, wie anspruchsvoll Nutzer den Inhalt erleben.

Ein Verbesserungsvorschlag besteht aus einem verpflichtenden Freitext und enthaelt keine erzwungene Sternebewertung. Dadurch werden quantitative Bewertungen und konkrete Aenderungswuensche in derselben zentralen Sicht sichtbar, aber fachlich unterscheidbar gespeichert.

## Verantwortlichkeiten

- Die Plattform UI zeigt das Formular im accountgebundenen Lern- oder Entwicklungsprojekt sowie direkt an der ausgewaehlten Projektvorlage.
- Der Identity Server prueft die aktive Sitzung und bei Projekten den Projektbesitz. Template-IDs muessen im serverseitigen Katalog vorkommen. Projekt-, Template- und Account-Zuordnung werden nicht aus frei uebermittelten Nutzerwerten uebernommen.
- Der Project Server validiert die vier Skalen und persistiert Projektfeedback in `project_learning_feedback` sowie Template-Feedback in `project_template_feedback` in PostgreSQL als fachliche Wahrheit.
- Das Admin Tool liest beide Feedbackarten ueber die vorhandene Project-Server-Schnittstelle, berechnet Mittelwerte nur aus Bewertungen und bietet Projekt-/Templatefilter. Es persistiert keine zweite fachliche Kopie.

## Datenschutz

Die Standardbewertung enthaelt keine Kontaktfreigabe. Account- und Kontaktdaten bleiben in der Admin-Sicht nach dem bestehenden zweckgebundenen Consent-/Rechtsgrundlagen- und Audit-Modell maskiert. Fuer spaetere Rueckfragen kann weiterhin ein feedbackspezifischer, zeitlich begrenzter Consent verwendet werden.

## Nachweis

- Project-Server-Tests fuer vollstaendige 1-bis-5-Skalen, Template-Bewertungen und getrennte Verbesserungsvorschlaege
- Identity-Routentests fuer serverseitig abgeleiteten Account, geprueften Projektbesitz und Katalog-Templates
- Admin-UI-Vertragstest fuer Navigation, zentrale Sicht, Projekt-/Templatefilter und API-Abruf
