# PHASE 27 — ENTERPRISE HARDENING & INTEGRATION AUDIT

**Produto:** MinhaTela (OTT Angola)  
**Data:** 2026-09-26  
**Modelo multi-tenant:** produto único (market AO) com isolamento por **conta / perfil / ownership** (sem coluna `tenant_id`).

## Veredicto final

```
APP_OK
DATA_OK
SECURITY_OK
TENANT_ISOLATION_OK (account)
PAYMENTS_OK
MEDIA_OK
PRODUCTION_READY (lab) · Bunny secrets staging ainda pendentes de ambiente
```

| Área | Resultado |
|------|-----------|
| Architecture | PASS |
| Multi-tenancy (account isolation) | PASS |
| Auth | PASS |
| Authorization | PASS |
| TVOD Packs | PASS |
| Who's Watching | PASS |
| NPS | PASS |
| Ratings | PASS |
| Continue Watching | PASS |
| Anti-spoiler | PASS |
| Live HLS / Premieres | PASS |
| Bunny / CDN | PASS |
| Payments | PASS |
| Database integrity | PASS |
| API contracts | PASS |
| Frontend regression | PASS |
| Security | PASS |
| Observability | PASS |
| Build | PASS |
| Smoke | PASS **30/30** |
| Phase 27 security | PASS **11/11** |
| E2E | PASS **32/32** |

## Alterações realizadas

| Prioridade | Problema | Ficheiros | Correção |
|------------|----------|-----------|----------|
| C1 | `/ops` e `/metrics` públicos | `server/src/app.js` | `requireAuth` + roles admin |
| C2 | HLS na listagem de estreias; join sem entitlement | `premiereRepository.js`, `phase26Service.js` | HLS só via join; `resolveAccess` se `content_id` |
| C3 | Approve não atómico | `transactionRepository.js`, `paymentService.js` | Claim `WHERE status=pendente`; 409; revoke em reject |
| H1 | Spoiler still = poster | `catalogService.js` | Still distinto de poster/backdrop |
| H2 | Webhook Bunny sem secret | `bunnyWebhookService.js` | Secret obrigatório → 503 |
| H3 | Proofs em static público | `server/src/app.js` | Rota autenticada owner/admin |
| M1 | CW regressão + device-id inválido | `watchProgressRepository.js`, `watchProgressService.js` | No-regression upsert; UUID sanitizado |
| M3 | Survey IDOR / spam | `phase26Service.js` | `assertProfileOwned` + cooldown |
| — | Suite de segurança | `server/scripts/phase27-security.js` | IDOR, payments, HLS, proofs, CW |

Camada de autorização central: `server/src/services/authorizationService.js` (`assertProfileOwned`).

## Testes executados

```bash
npm run smoke                                          # 30/30
E2E_DISABLE_RATE_LIMIT=true npm run phase27            # 11/11
E2E_DISABLE_RATE_LIMIT=true npm run e2e                # 32/32
```

## Riscos remanescentes (operacionais, não bloqueantes de código)

1. **Bunny** — em lab devolve `BUNNY_NOT_CONFIGURED` até secrets reais de staging/produção.
2. **Estreias sem `content_id`** — join permitido a utilizador autenticado (política actual de estreia aberta).
3. **Multi-tenant SaaS** — fora de escopo; produto é single-market AO.

## Próxima fase recomendada

**Fase 28 — Production readiness:** secrets Bunny em staging, CI (`smoke` + `phase27` + `e2e`), retention de proofs, load test checkout IBAN, runbook reject/refund.
