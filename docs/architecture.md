# Arquitectura MinhaTela (Fase Enterprise)

Fonte de verdade: **PostgreSQL**. Media: **Bunny Stream (HLS)**. Sem Supabase.

```
GOVERNANCE     SuperAdmin
OPERATIONS     Admin / Content / Finance / Support
OWNERSHIP      Creator / Production Company
CONSUMPTION    Subscriber (Account + Profiles)
```

```
AUTHN  → quem é o user (JWT + auth_sessions)
AUTHZ  → roles + role_permissions + memberships
TENANCY → tenants + tenant_memberships (default slug minhatela / AO)
RIGHTS → content_rights (pode a plataforma distribuir?)
ENTITLEMENT → subscription | purchase | pack_entitlements | rentals
PLAYBACK → POST /api/watch/:id/start → signed Bunny HLS
```

O cliente (Expo) só controla UX. `capabilities` no `/api/auth/me` não autorizam nada no servidor.
