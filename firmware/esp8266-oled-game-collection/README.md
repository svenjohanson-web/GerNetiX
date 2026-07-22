# GerNetiX ESP8266 OLED Spielesammlung

Eigenstaendige Spiel-Firmware für ein ESP8266-OLED-Board mit 0,96-Zoll-SSD1306-Display. Sie ist bewusst kein Bestandteil der geschützten ESP32-Basissoftware.

## Bestätigte Hardware

- ESP8266-Board: HW-364A / ESP8266 OLED
- Display: 128 × 64 Pixel, SSD1306 über I²C
- SDA: D6 / GPIO12
- SCL: D5 / GPIO14
- Einzige Eingabe: Flash-Taste auf GPIO0

Die Flash-Taste ist nach dem Start ein normaler Eingang. Sie darf jedoch nicht beim Reset gedrückt gehalten werden, da das Board sonst in den ESP8266-Bootloader startet.

## Bedienung

- Im Menü: kurz drücken wechselt das Spiel, lang drücken startet es.
- Im Spiel: kurz drücken führt die Spielaktion aus, lang drücken kehrt ins Menü zurück.

Enthalten sind **Reaktion**, **Sprungspiel** und **Ausweichen**.

## Manueller Build und Flash

Firmware-Build und Flash führt der Nutzer auf der angeschlossenen Hardware aus:

```powershell
cd C:\Users\sven_\Desktop\GerNetiX\firmware\esp8266-oled-game-collection
C:\Users\sven_\.platformio\penv\Scripts\platformio.exe run -e esp8266_oled_games
C:\Users\sven_\.platformio\penv\Scripts\platformio.exe run -e esp8266_oled_games -t upload --upload-port COMx
```
