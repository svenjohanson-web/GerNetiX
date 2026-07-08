# Hardware Shop API

MVP-API fuer kaufbare Hardware-Angebote, Warenkorb und Bestellung.

Der Hardware Shop ist fachlich ein Client des Hardware Catalog Service. Bekannte Boards,
Module und TechnicalCapabilities werden nicht im Shop gepflegt, sondern ueber den
Hardware Catalog gelesen.

## Basis

- `GET /health`
- Prefix: `/api/hardware-shop`

## Angebote und Matching

- `GET /api/hardware-shop/offers`
- `GET /api/hardware-shop/offers/{offerId}`
- `POST /api/hardware-shop/match`

`match` erwartet `required_capability_ids` und liefert passende Angebote inklusive fehlender Capabilities und Score.

## Warenkorb und Bestellung

- `POST /api/hardware-shop/carts`
- `GET /api/hardware-shop/carts/{cartId}`
- `POST /api/hardware-shop/carts/{cartId}/items`
- `POST /api/hardware-shop/orders`
- `GET /api/hardware-shop/orders/{orderId}`
- `GET /api/hardware-shop/orders/{orderId}/purchase-context`

Der Kaufkontext ist die fachliche Bruecke zu Provisioning, Device Management, Support und Reklamation.

## Admin

- `POST /api/hardware-shop/admin/offers`
