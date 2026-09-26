# FASE 28 — CONSOLE EMPRESA (Admin Console)

**Data:** 2026-09-26

## Veredicto

Área completa de gestão empresa/superadmin implementada no app (`/admin`), alinhada ao modelo interno Netflix (ops + conteúdo + suporte + flags) — **não** é um CMS público Netflix, é o Command Center MinhaTela.

## O que passou a existir

### UI — Console de Gestão (`AdminCommandCenter`)

| Tab | Função |
|-----|--------|
| Overview | KPIs + filas (incl. tickets) |
| Pagamentos | Aprovar/rejeitar IBAN/Multicaixa + risco |
| Atendimento | Tickets + FAQ/artigos |
| Moderação | Criadores, conteúdo, payouts, ads |
| Editorial | Colecções da Home |
| Flags | Feature flags + experiências A/B |
| Config / Onboard | Onboarding, suporte, branding (JSON) |
| CDN / Encode | Probe Bunny + fila encoding |
| Catálogo ops | Packs, NPS, estreias, gifts |
| Promos | Códigos Premium |
| Live | Streams activos |
| Auditoria | Trilha privilegiada |

Entrada: ícone escudo na Navbar (utilizadores `isAdmin`).

### Backend novo

- Migração `025_admin_console_app_settings.sql` → tabela `app_settings`
- `GET /api/app/config` — bootstrap público (onboarding/branding/support)
- `GET/PUT /api/admin/config/:key` — gestão admin
- `GET/POST /api/admin/help/articles` + publish
- Command Center inclui fila `tickets`

### APIs já existentes agora ligadas na UI

feature-flags, editorial, tickets, packs, surveys, premieres, gifts, CDN, encoding, payment risk, experiments.

## Como usar

1. Login com conta `super_admin` / `admin`
2. Abrir **/** escudo dourado → `/admin`
3. Gerir filas, flags, onboarding e atendimento

## Nota Netflix

A Netflix **tem** ferramentas internas (não públicas aos clientes) para catálogo, suporte e ops. A MinhaTela agora tem o equivalente operacional no produto.
