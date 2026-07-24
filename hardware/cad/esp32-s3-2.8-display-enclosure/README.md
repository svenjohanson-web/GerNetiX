# Gehäuse für ESP32-S3-Display ES3N28R

Das OpenSCAD-Modell ist aus der bereitgestellten Maßzeichnung des 2,8-Zoll-
ESP32-S3-Displays abgeleitet. Es besteht aus einem Unterteil und einem
Displayrahmen. Vier M3-Schrauben halten Rahmen, Platine und Unterteil zusammen.

## Abgeleitete Maße

- Platine: 86,0 × 60,0 × 1,6 mm
- Lochabstand: 78,0 × 50,0 mm
- Platinenbohrungen: 3,2 mm
- Display-Backlight: ungefähr 69,2 × 50,0 mm
- sichtbare aktive Fläche: 57,6 × 43,2 mm
- Standard-Sichtausschnitt im Modell: 70,0 × 50,4 mm
- zentrierter Akkuraum: ungefähr 65,5 × 35,5 × 10,0 mm

Der mittig an der kurzen Platinenseite eingezeichnete USB-C-Anschluss besitzt
standardmäßig einen abgerundeten Ausschnitt von 14 × 6 mm in der linken
Gehäusewand. Seine Maße lassen sich über `usb_opening_y`,
`usb_opening_width`, `usb_opening_bottom_z` und `usb_opening_height` anpassen.
Weitere generische Seitenöffnungen sind nicht vorgesehen.

## Akkufach

Unter der Platine befindet sich mittig ein Akkuraum für einen ungefähr
65,5 × 35,5 × 10,0 mm großen Akku. Das Unterteil ist dafür um 10,5 mm tiefer
als die ursprüngliche Ausführung. Ein 10,5 mm hoher rechteckiger Halterahmen auf dem
Gehäuseboden umfasst den Akku vollständig seitlich und besitzt eine
6-mm-Kabelöffnung im oberen Abschnitt seiner rechten Wand.

Die relevanten Parameter sind `battery_size`, `battery_xy_clearance`,
`battery_space_height`, `battery_tray_wall` und
`battery_cable_notch_width`. Über `battery_cable_notch_y` kann die Öffnung in
der rechten Rahmenwand nach oben oder unten verschoben werden. Vor dem Druck
müssen auch Kabel, Stecker, Schutzplatine und eine mögliche Aufblähung des Akkus
berücksichtigt werden.

## STL-Dateien erzeugen

1. `esp32-s3-2.8-display-enclosure.scad` in OpenSCAD öffnen.
2. Für beide Teile nebeneinander `part = "print_plate"` verwenden.
3. Alternativ für getrennte STL-Dateien `part = "base"` und danach
   `part = "lid"` einstellen.
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
- vier M3-Schrauben, ungefähr 10 mm lang

Zuerst nur einige Millimeter Höhe oder einen kleinen Anschluss-Teststreifen
drucken, um Druckspiel und Buchsenausschnitte zu prüfen. Für
M3-Gewindeeinsätze kann `boss_pilot_d` passend vergrößert werden.
