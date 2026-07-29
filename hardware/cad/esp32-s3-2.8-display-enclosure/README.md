# Gehäuse für ESP32-S3-Display ES3C28P

Das OpenSCAD-Modell ist aus der bereitgestellten Maßzeichnung des kapazitiven
2,8-Zoll-ESP32-S3-Displays ES3C28P und dem zugehörigen STEP-Modell
`ES3C28P_3D.step` abgeleitet. Es besteht aus einem Unterteil und einem
Displayrahmen. Vier Schnappverbindungen halten Rahmen, Platine und Unterteil
ohne Schrauben zusammen.

## Abgeleitete Maße

- Platine: 86,0 × 50,0 × 1,599 mm
- Lochabstand: 78,0 × 42,0 mm
- Platinenbohrungen: 3,2 mm
- Display-Backlight: ungefähr 69,2 × 50,0 mm
- sichtbare aktive Fläche: 57,6 × 43,2 mm
- Standard-Sichtausschnitt im Modell: 70,0 × 50,4 mm
- Bauteilhöhe unterhalb der Platine: maximal 4,7 mm
- Displayaufbau oberhalb der Platine: maximal 4,3 mm
- Touchoberfläche: 0,3 mm unterhalb der Deckeloberfläche
- zentrierter Akkuraum: ungefähr 65,5 × 35,5 × 10,0 mm
- Lautsprecheraufnahme: ungefähr 15,0 × 11,0 × 4,0 mm

Der mittig an der kurzen Platinenseite eingezeichnete USB-C-Anschluss besitzt
einen aus dem STEP-Modell abgeleiteten Steckerquerschnitt von 8,94 × 3,25 mm.
Der abgerundete Gehäuseausschnitt misst mit Platz für den Kabelstecker
13 × 8 mm. Die Aussparung im übergreifenden Deckelrand übernimmt exakt dessen
Breite und Oberkante, sodass beide Teile in montierter Lage fluchten.
Seine Maße und Toleranzen lassen sich über `usb_opening_y`,
`usb_horizontal_clearance`, `usb_vertical_clearance` und
`usb_opening_width_reduction`, `usb_opening_height_reduction` und
`usb_lid_relief_extra_width` anpassen.
Weitere generische Seitenöffnungen sind nicht vorgesehen.

## Akkufach

Unter der Platine befindet sich mittig ein Akkuraum für einen ungefähr
65,5 × 35,5 × 10,0 mm großen Akku. Der Akku ist um 3 mm nach Norden versetzt.
Das Unterteil ist dafür um 10,5 mm tiefer als die ursprüngliche Ausführung.
Ein 10,5 mm hoher rechteckiger Halterahmen auf dem Gehäuseboden umfasst den
Akku vollständig seitlich und besitzt eine
6-mm-Kabelöffnung im oberen Abschnitt seiner linken Wand.

Die relevanten Parameter sind `battery_size`, `battery_xy_clearance`,
`battery_space_height`, `battery_tray_wall` und
`battery_cable_notch_width`. Über `battery_cable_notch_y` kann die Öffnung in
der linken Rahmenwand nach oben oder unten verschoben werden. Vor dem Druck
müssen auch Kabel, Stecker, Schutzplatine und eine mögliche Aufblähung des Akkus
berücksichtigt werden.

## Lautsprecher

Im südlichen Bereich unter der Platine befindet sich eine Aufnahme für einen
15 × 11 × 4 mm großen Lautsprecher. Er steht mit 15 mm waagerecht und 11 mm
senkrecht an der südlichen Gehäusewand. Seine Membran strahlt durch ein Gitter
aus fünf senkrechten, abgerundeten Schlitzen nach außen. Jeder Schlitz ist
1,2 × 11 mm groß. Der Lautsprecher sitzt 25 mm links von der Gehäusemitte in
Richtung des USB-Endes.

Ein oben offener, mit dem Gehäuseboden verbundener Führungsrahmen ermöglicht
das Einsetzen vor der Platinenmontage. Seine Rückwand hält den Lautsprecher
gegen das Seitengitter. Nach dem Verschrauben begrenzt die Platinenunterseite
mit 0,2 mm Spiel die Bewegung nach oben. Der Deckel besitzt deshalb keine
Lautsprecherhalterung mehr. Die frühere 12-mm-Verlängerung des Gehäuses ist
entfallen; das Nord-/Südmaß richtet sich wieder nach der Platine. Im
Gehäuseboden befinden sich keine Schallschlitze. In der rechten Seitenführung
der Aufnahme befindet sich ein bis nach oben offener Kabelschlitz. Dadurch
kann das an der kurzen Lautsprecherseite austretende Kabel beim Einsetzen von
oben in die Führung eingelegt werden. Die Aufnahme besitzt 1,6 mm starke
Wände; der Kabelschlitz ist auf 3 mm begrenzt, sodass davor und dahinter
tragende Stege stehen bleiben.

Die relevanten Parameter sind `speaker_size`, `speaker_clearance`,
`speaker_bottom_clearance`, `speaker_case_extension_y`,
`speaker_offset_x`, `speaker_board_clearance`,
`speaker_cable_slot_bottom_z`, `speaker_cable_slot_depth` sowie die
`speaker_grille_*`-Parameter.

## Schraubenloser Schnappdeckel

Der 7 mm hohe Deckelrand greift außen über das Unterteil. Vier halbrunde
Rastwülste im Deckel greifen in lokale Taschen der beiden langen
Gehäuseseiten. Die Raststellen sind so verteilt, dass USB-Öffnung,
Lautsprechergitter und Kabelweg frei bleiben. Über dem Lautsprechergitter ist
der verlängerte Deckelrand ausgespart.

Vier 2,8 mm starke Führungsstifte im Unterteil greifen jeweils 1,3 mm tief in
die 3,2-mm-Platinenbohrungen. Geschlossene Auflagezylinder im Deckel drücken
die Platine beim Einrasten auf die Abstandshalter. Dadurch bleiben auch
Platine und Lautsprecher ohne Schrauben in ihrer vorgesehenen Höhe.

Zum Öffnen einen langen Deckelrand an den Raststellen vorsichtig nach außen
ziehen und diese Seite des Deckels leicht anheben. Danach die gegenüberliegende
Seite lösen. PETG eignet sich wegen seiner höheren Elastizität besser für
häufiges Öffnen als sprödes PLA.

Die Passung lässt sich über `lid_fit_clearance`, `snap_bump_protrusion`,
`snap_bump_radius`, `snap_recess_depth` und `snap_recess_height` abstimmen.
Bei einem sehr strammen Probedruck sollte zuerst
`snap_bump_protrusion` in Schritten von 0,05 mm reduziert werden. Die
Standardwerte verwenden 0,20 mm Deckelspiel pro Seite und 0,85 mm
Rastwulstüberstand, damit die Nasen auch bei leichtem seitlichem Spiel sicher
in den Taschen bleiben.

## Bodenlogo

Auf der äußeren Unterseite sitzt das GerNetiX-Logo mit offenem Buch,
Leiterbahnen und Cloud über dem Schriftzug „GerNetiX.com“. Beide bilden
gemeinsam eine 0,6 mm tiefe, separate Einlage. Logo und Gehäuseboden enden
exakt auf derselben Ebene; die fertige Unterseite bleibt daher vollständig
flächenbündig. Im SCAD-Modell ist das gesamte Motiv gespiegelt, damit es beim
Blick auf die fertige Unterseite richtig lesbar ist. Für die kleine
CAD-Einlage wird eine druckgerecht vereinfachte Vektorkontur aus
`gernetix-book-cloud-cad.svg` verwendet.

Für den Mehrfarbdruck `part = "base"` und `part = "logo"` getrennt als STL
exportieren. Beide Dateien anschließend gemeinsam in Bambu Studio öffnen und
als ein Objekt mit mehreren Teilen laden. Weil beide STL-Dateien dieselben
Koordinaten verwenden, liegt das Logo automatisch passend in der Aufnahme.
Danach Unterteil und Logo unterschiedlichen Filamenten zuweisen.

`part = "base_complete"` erzeugt alternativ ein einteiliges, vollständig
gefülltes Unterteil für einen einfarbigen Druck. Text, Schriftart, Größen,
Abstände, Tiefe und Position lassen sich über die `bottom_logo_*`-Parameter
anpassen.

## STL-Dateien erzeugen

1. `esp32-s3-2.8-display-enclosure.scad` in OpenSCAD öffnen.
2. Für einen einfarbigen Druck beide Gehäuseteile nebeneinander mit
   `part = "print_plate"` exportieren.
3. Für den mehrfarbigen Logodruck `part = "base"`, danach `part = "logo"` und
   schließlich `part = "lid"` getrennt exportieren.
4. Mit `F6` rendern.
5. Über `Datei → Exportieren → Als STL exportieren` speichern.

`part = "assembly"` zeigt die zusammengesetzte Vorschau einschließlich einer
vereinfachten Platinen- und Displaydarstellung.

Die Standardeinstellung `part = "print_plate"` legt Unterteil und Displayrahmen
mit 10 mm Abstand flach nebeneinander. Beide passen zusammen auf ein übliches
220 × 220-mm-Druckbett. Viele Slicer erkennen die beiden getrennten Körper
automatisch; falls nicht, die Funktion „In Objekte aufteilen“ verwenden.

## Empfohlener Probedruck

- Material: PETG oder PLA
- Schichthöhe: 0,20 mm
- 4 Außenwände
- 20–30 % Infill
- Unterteil mit Boden auf dem Druckbett
- Displayrahmen mit der sichtbaren Vorderseite auf dem Druckbett

Zuerst nur einige Millimeter Höhe oder einen kleinen Anschluss-Teststreifen
drucken, um Druckspiel, Rastverbindung und Buchsenausschnitte zu prüfen.
