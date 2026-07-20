# GerNetiX Flashbox - Inventar- und Katalog-Datenmodell

## Grundsatz

Die Flashbox ist ein kaufbares GerNetiX-Hardwareprodukt und ein inventarisierbares Werkzeuggeraet. Nutzer koennen normale Zielboards selbst erfassen oder als Community-Hardware nutzen, aber keine eigene Flashbox als vertrauenswuerdige GerNetiX-Flashbox anlegen.

Das Zusammenspiel mit Identity, Hardware Catalog, Webshop, Device Management, Firmware-Artefakten und Recovery ist in [GerNetiX Flashbox - Systemzusammenspiel](flashbox-system-integration.md) definiert.

Kurzregel:

- Flashboxen kommen ausschliesslich aus GerNetiX-Webshop, Provisionierung, Produktion oder Admin-/Support-Korrektur ins System.
- Eine Flashbox hat eine GerNetiX-Seriennummer, ein Hardwareprofil, eine Firmware-Identitaet und einen Besitz-/Claim-Kontext.
- Eine selbst gebaute ESP32-S3-Platine oder ein altes Display-/Touch-Testboard ist technisch ein Board, aber fachlich keine GerNetiX-Flashbox.
- Die UI bietet keinen Weg "Flashbox selbst erstellen" an.

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
| `PurchasedHardwareUnit` | konkret produzierte oder verkaufte Einheit | `unit_id`, `hardware_item_id`, `serial_number`, `purchase_context_id`, `factory_batch_id`, `claim_state`, `created_at` |
| `AccountHardwareInventory` | Zuordnung einer Hardwareeinheit zu einem Account | `account_id`, `unit_id`, `inventory_name`, `ownership_state`, `claimed_at`, `revoked_at` |
| `FlashboxRuntimeState` | letzter bekannter Betriebszustand | `unit_id`, `firmware_version`, `update_status`, `trust_state`, `last_seen_at`, `last_manifest_id` |
| `FlashboxTargetSupport` | konkrete Flash-Unterstuetzung | `unit_id` oder `hardware_profile_id`, `target_family`, `target_profile`, `support_state`, `min_flashbox_firmware` |

Wichtige Constraints:

- `PurchasedHardwareUnit.hardware_item_id` muss auf ein Katalogprodukt mit `hardware_class = flashbox` zeigen, wenn die Einheit als Flashbox verwendet werden soll.
- `serial_number` ist fuer Flashboxen verpflichtend und eindeutig.
- `purchase_context_id` oder ein gleichwertiger Produktions-/Admin-Kontext ist fuer Flashboxen verpflichtend.
- Ein Nutzer darf `AccountHardwareInventory` fuer Flashboxen nur ueber Claim-/Aktivierungscode, Shop-Zuordnung oder Support-Korrektur erhalten.
- Manuelle Nutzeranlage ist fuer `hardware_class = flashbox` gesperrt.
- Community-Hardware darf nie automatisch die Capability `flashbox.target_flash` erhalten.

## Claim- und Aktivierungsweg

Der Webshop und Identity bleiben fachlich getrennt. Der Webshop kennt Bestellungen und Kontakt-E-Mail. Identity kennt Account, Besitz und Aktivierung.

Erlaubte Wege fuer eine Flashbox ins Account-Inventar:

1. Webshop-Kauf erzeugt eine `PurchasedHardwareUnit` und einen claimbaren Besitzkontext.
2. Der Nutzer meldet sich in Identity an und loest einen Aktivierungs-/Claim-Code ein.
3. Identity verknuepft die konkrete Seriennummer mit `AccountHardwareInventory`.
4. Erst danach erscheint die Flashbox in Auswahlfeldern fuer Flash- und Provisioning-Ablaeufe.

Nicht erlaubt:

- "Ich habe ein aehnliches Board gebaut, daraus eine Flashbox machen."
- "Flashbox ohne Seriennummer anlegen."
- "Flashbox nur per Freitext im Provisioning auswaehlen."
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
- Ist keine Flashbox inventarisiert, zeigt die UI statt einer manuellen Anlage die Wege "Flashbox kaufen" und "gekaufte Flashbox aktivieren".
- Ist die Flashbox veraltet, zeigt die UI zuerst "Flashbox aktualisieren" oder blockiert, wenn die Ziel-Firmware eine neuere Flashbox-Firmware zwingend voraussetzt.
- Der eigentliche Flashauftrag referenziert die konkrete `unit_id`, nicht nur den Produkttyp.

## Produktgrenze

Diese Trennung ist absichtlich hart: Die Flashbox ist ein vertrauenswuerdiges GerNetiX-Werkzeugprodukt. Sie darf Zielgeraete mit signierten Artefakten flashen, deshalb braucht sie Herkunft, Seriennummer, Updatezustand und widerrufbare Vertrauensstellung.

Selbstbau bleibt fuer Zielhardware erlaubt, aber nicht fuer die Flashbox-Rolle.
