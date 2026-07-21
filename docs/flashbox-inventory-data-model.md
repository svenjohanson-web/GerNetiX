# GerNetiX Flashbox - Inventar- und Katalog-Datenmodell

## Grundsatz

Die Flashbox ist ein kaufbares **oder selbst herstellbares** GerNetiX-Werkzeuggeraet und ein inventarisierbares Werkzeuggeraet. Selbstbau wird nur nach einer gefuehrten Zertifizierung mit dem aktiven Flashbox-Referenzprofil vertrauenswuerdig; normale Zielboards bleiben weiterhin frei erfassbare Community-Hardware.

Das Zusammenspiel mit Identity, Hardware Catalog, Webshop, Device Management, Firmware-Artefakten und Recovery ist in [GerNetiX Flashbox - Systemzusammenspiel](flashbox-system-integration.md) definiert.

Kurzregel:

- Flashboxen kommen aus GerNetiX-Webshop, Factory-Provisionierung, dem Selbstbau-Zertifizierungsweg oder einer Admin-/Support-Korrektur ins System.
- Eine Flashbox hat ein freigegebenes Hardwareprofil, eine Firmware-Identitaet, eine Besitzbindung und `origin_type`.
- Selbstbau ist nur fuer das aktive Referenzprofil erlaubt: ESP32-S3, mindestens 16 MB Flash, 8 MB PSRAM, zwei getrennte datenfaehige USB-Ports, USB-OTG-Host und geprüfte 5-V-VBUS-Stromversorgung mit Power-Switch und Strombegrenzung.
- Die UI bietet einen gefuehrten Weg "Flashbox selbst herstellen", aber keinen Freitext- oder Umgehungsweg.

## Rolle im Hardware Catalog

Der Hardware Catalog muss Flashboxen als eigene Hardwareklasse aufnehmen. Eine Flashbox kann intern auf ESP32-S3 basieren, wird aber nicht als normales Ziel-ProcessorBoard behandelt.

Logische Katalogstruktur:

| Struktur | Zweck | Wichtige Felder |
| --- | --- | --- |
| `HardwareCatalogItem` | kaufbares oder waehbares Hardwareprodukt | `hardware_item_id`, `sku`, `name`, `hardware_class`, `catalog_status`, `shop_visible` |
| `FlashboxHardwareProfile` | technisches Profil der Flashbox | `hardware_profile_id`, `hardware_item_id`, `mcu_family`, `flash_mb`, `display_profile`, `usb_otg_host`, `vbus_capability`, `input_profile` |
| `FlashboxCapabilityProfile` | fachliche Faehigkeiten der Produktklasse | `hardware_profile_id`, `capability_key`, `capability_version`, `supported_target_family`, `requires_online_manifest` |

Verbindliche Werte fuer Flashbox-Produkte:

- `hardware_class = flashbox`
- `shop_visible = true`, sobald das Produkt im Webshop auftauchen darf
- `catalog_status` unterscheidet mindestens `draft`, `active`, `retired`
- Capability-Schluessel enthalten mindestens `flashbox.self_update`, `flashbox.usb_otg_host`, `flashbox.target_flash`, `flashbox.signed_manifest_download`

## Inventarstruktur

Im Nutzerkonto wird nicht nur "eine Flashbox-Art" gespeichert, sondern eine konkrete Flashbox-Instanz. Dadurch kann ein Flash-/Provisioning-Ablauf genau fragen: "Welche deiner Flashboxen soll verwendet werden?"

Logische Inventarstruktur:

| Struktur | Zweck | Wichtige Felder |
| --- | --- | --- |
| `PurchasedHardwareUnit` | konkret produzierte, verkaufte oder selbstbau-zertifizierte Einheit | `unit_id`, `hardware_item_id`, `serial_number`, `origin_type`, `purchase_context_id`, `factory_batch_id`, `claim_state`, `created_at` |
| `AccountHardwareInventory` | Zuordnung einer Hardwareeinheit zu einem Account | `account_id`, `unit_id`, `inventory_name`, `ownership_state`, `claimed_at`, `revoked_at` |
| `FlashboxRuntimeState` | letzter bekannter Betriebszustand | `unit_id`, `firmware_version`, `update_status`, `trust_state`, `last_seen_at`, `last_manifest_id` |
| `FlashboxTargetSupport` | konkrete Flash-Unterstuetzung | `unit_id` oder `hardware_profile_id`, `target_family`, `target_profile`, `support_state`, `min_flashbox_firmware` |

Wichtige Constraints:

- `PurchasedHardwareUnit.hardware_item_id` muss auf ein Katalogprodukt mit `hardware_class = flashbox` zeigen, wenn die Einheit als Flashbox verwendet werden soll.
- `serial_number` bzw. eine vom Selbstbau-Zertifizierungsweg erzeugte Registriernummer ist fuer Flashboxen verpflichtend und eindeutig.
- `purchase_context_id`, Factory-/Admin-Kontext oder ein erfolgreicher Selbstbau-Zertifizierungsnachweis ist fuer Flashboxen verpflichtend.
- Ein Nutzer darf `AccountHardwareInventory` fuer Flashboxen nur ueber Claim-/Aktivierungscode, Shop-Zuordnung, erfolgreiches Selbstbau-Zertifikat oder Support-Korrektur erhalten.
- Freitextanlage ist fuer `hardware_class = flashbox` gesperrt; der Selbstbau-Assistent ist der einzige Nutzerweg.
- Community-Hardware darf nie automatisch die Capability `flashbox.target_flash` erhalten.

## Claim- und Aktivierungsweg

Der Webshop und Identity bleiben fachlich getrennt. Der Webshop kennt Bestellungen und Kontakt-E-Mail. Identity kennt Account, Besitz und Aktivierung.

Erlaubte Wege fuer eine Flashbox ins Account-Inventar:

1. Webshop-Kauf erzeugt eine `PurchasedHardwareUnit` und einen claimbaren Besitzkontext.
2. Der Nutzer meldet sich in Identity an und loest einen Aktivierungs-/Claim-Code ein.
3. Identity verknuepft die konkrete Seriennummer mit `AccountHardwareInventory`.
4. Erst danach erscheint die Flashbox in Auswahlfeldern fuer Flash- und Provisioning-Ablaeufe.
5. Der Selbstbau-Assistent prueft das aktive Referenzprofil, laesst die Flashbox ihren Device-Key erzeugen, validiert die Challenge-Signatur und legt danach eine Einheit mit `origin_type = self_manufactured_certified` an.

### Komfortweg: oeffentlich flashen, intern zuordnen

Der Flash-Schritt ist absichtlich vom Account-Schritt getrennt:

```text
Oeffentlicher Bereich oder Dialog im internen Bereich
-> derselbe accountneutrale Flash-Assistent prueft das Referenzprofil
-> signiertes Flashbox-Initialimage wird lokal geflasht
-> Flashbox meldet flashbox_initial_firmware_ready
-> nur im internen Bereich: Discovery + Challenge-Signatur
-> angemeldeter Account uebernimmt genau diese Einheit ins Inventar
```

Der oeffentliche Assistent braucht keine Anmeldung und speichert keine Accountdaten. Im internen Bereich fragt der Einstieg zuerst, ob die Flashbox bereits geflasht ist. Bei `ja` startet direkt die sichere Uebernahme. Bei `nein` erscheint der oeffentliche Assistent als Dialog; nach dessen erfolgreichem Abschluss uebernimmt der angemeldete Controller genau diese Einheit. Ein Nutzer mit mehreren Accounts muss sich daher nicht auf dem fremden Rechner anmelden und kann im eigenen internen Bereich bewusst den gerade angemeldeten Account verwenden.

Nicht erlaubt:

- "Ich habe ein aehnliches Board gebaut, daraus ohne Referenzprofil-Pruefung eine Flashbox machen."
- "Flashbox ohne Seriennummer anlegen."
- "Flashbox nur per Freitext im Provisioning auswaehlen."
- "Oeffentlichen Flash-Assistenten fuer eine Account-Zuordnung oder einen Account-spezifischen Download verwenden."
- "Community-Flashbox als gleichwertiges GerNetiX-Tool behandeln."

## Auswahl im Flash-/Provisioning-Ablauf

Wenn ein Nutzer neue Software auf ein Zielgeraet bringen will, muss die UI den Transportweg zuerst klar machen:

| Weg | Bedeutung | Folgeschritt |
| --- | --- | --- |
| `native_mobile` | lokaler oder nativer Ablauf auf einem unterstuetzten Geraet | Plattform-/Feature-Pruefung, z. B. iOS-Einschraenkungen |
| `wlan` | bereits erreichbares Zielgeraet im Netzwerk | erreichbares Device oder Provisioning-Endpunkt waehlen |
| `flashbox` | GerNetiX-Flashbox flasht das Zielgeraet ueber USB-OTG | konkrete inventarisierte Flashbox auswaehlen |

Fuer `flashbox` gilt:

- Die Auswahl zeigt nur Flashboxen des angemeldeten Accounts.
- Angezeigt werden Name, Seriennummer, Firmwareversion, Updatezustand, letzter Kontakt und unterstuetzte Zielgeraete.
- Ist keine Flashbox inventarisiert, zeigt die UI die Wege "Flashbox kaufen", "gekaufte Flashbox aktivieren" und "Flashbox selbst herstellen".
- Ist die Flashbox veraltet, zeigt die UI zuerst "Flashbox aktualisieren" oder blockiert, wenn die Ziel-Firmware eine neuere Flashbox-Firmware zwingend voraussetzt.
- Der eigentliche Flashauftrag referenziert die konkrete `unit_id`, nicht nur den Produkttyp.

## Produktgrenze

Diese Trennung ist absichtlich hart: Die Flashbox ist ein vertrauenswuerdiges GerNetiX-Werkzeuggeraet. Sie darf Zielgeraete mit signierten Artefakten flashen, deshalb braucht sie ein freigegebenes Referenzprofil, kryptographische Identitaet, Updatezustand und widerrufbare Vertrauensstellung.

Selbstbau ist fuer die Flashbox-Rolle erlaubt, aber nur nach der Referenzprofil-Zertifizierung. Der Nutzen ist ein leichterer Einstieg; kaufbare Flashboxen behalten ihre getrennte Produkt-, Garantie- und Supportgrenze.
