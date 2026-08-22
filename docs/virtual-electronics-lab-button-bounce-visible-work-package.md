# ELAB-FS-005: Tasterprellen sichtbar messen

Stand: 2026-08-17  
Status: umgesetzt und im Browser getestet

Die vorhandene Taster-Laborfläche zeigt die gemeinsame digitale Messspur aus
FS-004. Druck und Loslassen erzeugen deterministische Spuren; Messcursor,
Flankenzahl und stabiler `digitalRead`-Wert werden ausschließlich daraus
gelesen. Ein separates Oszilloskop-Labor, Timer und MCU-Emulation gehören nicht
zum Paket. Die Realitätsbrücke nennt Massebezug sowie reale, aufbauabhängige
Prellzeiten.
