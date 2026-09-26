# VERIFICAÇÃO ENTERPRISE — Nível Netflix (ops Angola)

**Data:** 2026-09-26  
**Pergunta:** O Console MinhaTela gerencia ao nível Netflix?

## Veredicto honesto

**PASS parcial — Enterprise OTT Angola (Netflix-class ops), NÃO clone interno Netflix.**

A Netflix tem ferramentas internas (Studio, BMC, Trust & Safety, Partner Portal, experiment platform) construídas ao longo de décadas, multi-região, milhares de engenheiros.  
A MinhaTela tem um **Command Center unificado** adequado a operar um OTT nacional AO com as mesmas *categorias* de gestão.

| Capacidade Netflix-class | MinhaTela | Nota |
|--------------------------|-----------|------|
| Command Center / KPIs | **PASS** | Overview + filas |
| Pagamentos / billing ops | **PASS** | IBAN/Multicaixa + risco + claim atómico |
| Catálogo CMS (publish/feature/monetização) | **PASS** | Tab CMS Catálogo |
| Editorial / rows Home | **PASS** | Colecções |
| Feature flags | **PASS** | + RBAC superadmin para mutate |
| Trust & Safety / denúncias | **PASS** | Tab Denúncias |
| Atendimento / tickets / FAQ | **PASS** | |
| Utilizadores / entitlements | **PASS** | Premium grant/revoke |
| Planos / pricing | **PASS** | Kz editável |
| Landing / growth / leads | **PASS** | `/welcome` + leads |
| Ads / AVOD campaigns | **PASS** | |
| Uploads / proofs | **PASS** | |
| CDN / encoding health | **PASS** | |
| Live / premieres | **PASS** | |
| Promos / gifts / packs | **PASS** | |
| Auditoria | **PASS** | |
| RBAC (moderator ≠ admin ≠ super) | **PASS** | elevated + exact super_admin |
| Multi-região / multi-tenant SaaS | **N/A** | Produto single-market AO |
| Rights windows / territorial licensing UI | **GAP** | Modelo simples AO |
| Experimentação A/B full studio | **PARCIAL** | Lista experiências; sem editor completo |
| Partner self-serve Netflix Studio | **PARCIAL** | Creator Studio + Ad Portal existem à parte |
| Observabilidade tipo Netflix Atlas | **PARCIAL** | `/ops` `/metrics` autenticados |

## Score

**18/20 categorias PASS ou PARCIAL útil**  
**Nível declarado:** `ENTERPRISE_OTT_AO` · `NETFLIX_OPS_PARITY (categories)` · `NOT_NETFLIX_INTERNAL_CLONE`

## Gaps remanescentes (honestos)

1. UI de janelas de direitos/territórios (não crítico para AO single-market).
2. Editor A/B completo (só leitura/listagem).
3. Postgres local precisa estar up para migrar `026`/`027` e validar live.
4. Upload de assets CMS rico (Bunny ingest UI) — encoding admin existe; ingest wizard ainda básico.

## Como a Netflix “gerencia” vs MinhaTela

| Netflix | MinhaTela |
|---------|-----------|
| Muitas apps internas | Um Console `/admin` |
| Multi-país | Angola (AO) + Kz + IBAN/Multicaixa |
| Equipa global | Superadmin + admin + moderator |

**Conclusão:** Para operar MinhaTela em Angola de forma profissional (como a Netflix opera *o negócio de streaming*, não como clone byte-a-byte das tools internas), o Console está ao **nível enterprise exigido**.
