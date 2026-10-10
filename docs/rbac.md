# RBAC MinhaTela

Modelo: **User + Tenant Membership + Role + Permission + resource ownership**.

Roles de plataforma (`roles` / `user_roles`):

| Role | Superfície |
| --- | --- |
| `super_admin` | Governação global (tenants, secrets, flags críticas) |
| `admin` | Operação (catálogo, rights, suporte, pagamentos) |
| `moderator` | Moderação / tickets |
| `content_manager` | Catálogo, acquisition, rights |
| `finance_manager` | Pagamentos / payouts |
| `support_agent` | Tickets / subscribers |
| `creator` | Creator Studio (próprio conteúdo) |
| `producer` / `production_*` | Portal da produtora |
| `customer` | Consumo |
| `advertiser` | Ad platform |

Permissions em `role_permissions`. SuperAdmin recebe `*`.

Admin **não** tem: `platform.tenants.manage`, `platform.secrets.manage`, `platform.roles.manage`, `platform.admins.manage`.

Promover `super_admin` só é aceite se o actor já for SuperAdmin.

MFA (TOTP) é **opt-in** (`POST /api/auth/mfa/*`). Com MFA activo, o login exige segundo factor. Operações críticas (suspender tenant) fazem step-up se o user tiver MFA. Four-eyes (`/api/admin/approvals`) só bloqueia quando existem 2+ SuperAdmins; com um único SuperAdmin a acção executa-se com `reason` + audit (`four_eyes_bypassed`).

Produtora: `company_members.role` ∈ owner | manager | editor | finance.
