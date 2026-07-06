# Hardware Shop API

MVP-API fuer Hardware-Katalog und Shop.

## Basis

- `GET /health`
- Prefix: `/api/hardware-shop`

## Katalog

- `GET /api/hardware-shop/capabilities`
- `GET /api/hardware-shop/hardware-items`
- `GET /api/hardware-shop/hardware-items/{hardwareItemId}`
- `GET /api/hardware-shop/processor-boards`

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

- `POST /api/hardware-shop/admin/capabilities`
- `POST /api/hardware-shop/admin/hardware-items`
- `POST /api/hardware-shop/admin/offers`
