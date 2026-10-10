# Entitlements

Três conceitos distintos:

- **Subscription** — relação comercial recorrente (`users.subscription_status` / household).
- **Purchase** — transacção (`transactions`) + rental 48h calculado no backend.
- **Entitlement** — autorização de consumo (`rentals`, `pack_entitlements`).

Motor único: `entitlementService.authorizeWatch()` usado por playback e `POST /api/premieres/:id/join`.

Ordem: tenant → publicação → rights → paywall (`accessControlService`).
