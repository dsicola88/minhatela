# FASE 28b — CONSOLE NETFLIX-AO (gestão total)

**Objetivo:** Console empresa ao nível Netflix interno, com realidade Angola (IBAN/Multicaixa, Kz, WhatsApp leads).

## Áreas do Console `/admin`

| Tab | Capacidade |
|-----|------------|
| Overview | KPIs + filas |
| Landing / Pay | Hero, CTAs, leads form, IBAN/Multicaixa |
| Pagamentos | Aprovar comprovativos + risco |
| Utilizadores | Pesquisa, admin flag, Premium grant/revoke |
| Planos | CRUD preços/benefícios em Kz |
| Leads | Pipeline comercial |
| Atendimento | Tickets + FAQ |
| Moderação | Creators, conteúdo, payouts |
| Anúncios | Campanhas AVOD full list |
| Uploads | Media library + comprovativos |
| Editorial / Flags / Config | Home rows, feature flags, onboarding |
| CDN / Catálogo / Promos / Live / Audit | Ops restante |

## Público

- `GET /api/app/config` — landing + payments + onboarding
- `POST /api/leads` — captura de lead (rate limited)
- `/welcome` — landing marketing editável

## Migrações

- `025` app_settings
- `026` subscription_plans · leads · media_uploads · landing/payments seeds

## Angola

- Moeda AOA / Kz
- Pagamento IBAN + Multicaixa configuráveis
- Lead com telefone WhatsApp (+244)
- Copy e planos locais

## Activar

```bash
docker compose up -d postgres
cd server && node scripts/migrate.js
# login superadmin → /admin
```
