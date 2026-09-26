# MinhaTela

Plataforma OTT enterprise para o mercado angolano.
Experiência de consumidor nível premium · identidade própria (cores da bandeira de Angola).

## Arquitectura

```text
Expo (mobile/)
   │ HTTPS
   ▼
Node/Express (server/src)
   ├──────────────► PostgreSQL
   └──────────────► Bunny Stream
```

A decisão de reprodução é **sempre** da API:

`POST /api/watch/:contentId/start`

Fluxo: autenticar → conteúdo → direitos → AVOD/SVOD/TVOD → ads → Bunny.

## Estrutura

```text
MinhaTela/
├── mobile/                 # Expo + Expo Router + NativeWind
│   ├── app/
│   ├── src/components/
│   ├── src/screens/
│   ├── src/services/       # HTTP apenas
│   └── hooks/
├── server/
│   └── src/
│       ├── controllers/
│       ├── routes/
│       ├── services/
│       ├── repositories/
│       ├── middleware/
│       ├── validators/
│       └── utils/
├── database/
│   ├── migrations/
│   └── seed/
├── docker-compose.yml
└── README.md
```

## Arranque local

```bash
cp .env.example .env
docker compose up -d postgres
npm run migrate
npm --prefix server run seed
npm run dev:api
npm run dev:web
```

Ou stack completa:

```bash
docker compose up -d --build
```

## Deploy (GitHub → Railway + Vercel)

Guia completo: **[DEPLOY.md](./DEPLOY.md)**

| Serviço | Plataforma | Pasta |
|---------|------------|--------|
| API + Postgres | Railway | `server/` + plugin PostgreSQL |
| Web (Expo) | Vercel | `mobile/` (Root Directory) |

Resumo rápido:

1. Push do monorepo para o GitHub  
2. Railway: deploy do repo + PostgreSQL + vars (`JWT_SECRET`, `CORS_ORIGIN`, …)  
3. Vercel: Root `mobile` + `EXPO_PUBLIC_API_BASE_URL` = URL da API  
4. Actualizar `CORS_ORIGIN` / `APP_PUBLIC_URL` no Railway com o domínio Vercel  

## Endpoints críticos

| Método | Path | Função |
|--------|------|--------|
| POST | `/api/auth/login` | Sessão + refresh |
| POST | `/api/auth/refresh` | Renovar access token |
| GET | `/api/auth/sessions` | Sessões activas |
| POST | `/api/auth/forgot-password` | Recuperação (anti-enumeration) |
| POST | `/api/auth/reset-password` | Nova palavra-passe |
| GET | `/api/catalog/home` | Home + Continuar a assistir |
| GET | `/api/catalog/content/:id` | Detalhes + access |
| GET | `/api/catalog/share/:id` | Card público / deep link |
| POST | `/api/watch/:contentId/start` | Autorização de play + Bunny |
| PUT | `/api/watch/:contentId/progress` | Progresso (throttled) |
| POST | `/api/payments/checkout` | Comprovativo IBAN/Multicaixa |
| GET | `/api/admin/dashboard` | KPIs ops |
| GET | `/api/admin/transactions/pending` | Fila de pagamentos |
| PATCH | `/api/admin/transactions/:id/status` | Aprovar / rejeitar |
| GET | `/metrics` | Métricas machine-readable |

## Search & Recommendations

- `GET /api/search?q=` — full-text PT + analytics
- Home inclui: Continuar a assistir, Recomendados, A Minha Lista, Porque assistiu, Conteúdo gratuito
- Favoritos: `POST/DELETE /api/discovery/favorites/:id`

## Creator Payouts

- Pedido no Creator Studio (mín. 5.000 Kz, IBAN obrigatório)
- Admin aprova em `/admin/content`

## Ad Platform

```text
/ads
```

Campanhas AVOD (`pending_review` → `active`). Decision em `GET/POST /api/ads/decision` usada no play AVOD.

## Admin

- `/admin/content` — criadores + conteúdos
- `/admin/payments` — comprovativos IBAN/Multicaixa

## Discovery · Trailers · Ratings · Data Saver

- Trailers na ficha de detalhes
- Thumbs up/down por perfil (alimenta analytics)
- **Lembrar-me** em títulos Em breve
- Pesquisa com filtros: tipo, monetização, género
- Poupança de dados (default ON) → embed 480p

## Admin Command Center

- `/admin` — Overview · Pagamentos · Moderação · Live streams · Auditoria
- KPIs: utilizadores, Premium, receita hoje/7d, plays, streams activos, filas
- Filas: pagamentos, criadores, conteúdo, payouts, campanhas ads
- Audit trail com actor + IP
- Streams live (heartbeat &lt; 90s)

## Engagement · Notificações · Histórico

- Centro de notificações (`/notifications`) com badge no Navbar
- Pagamento submetido / aprovado / rejeitado → notificação + email transaccional
- Histórico de visualização por perfil (`/history`)
- Os meus pagamentos (`/payments`)
- Home: filas **Novidades** e **Em breve**
- Coming soon: detalhes visíveis, play bloqueado (`COMING_SOON`)

## Séries · Episódios · Autoplay

- Conteúdo `movie` | `series` | `episode`
- Detalhes de série com temporadas + progresso por episódio
- Play de série resolve episódio a continuar / primeiro
- Player: **Saltar intro**, **Seguinte episódio** (créditos / tecla N)
- Home/search mostram só filmes e séries (episódios ocultos no browse)

## Conta · Dispositivos · Maturidade

- **Conta** `/account` — plano, streams, dispositivos, sessões, logout
- **Perfis** — até 4, Kids, PIN 4 dígitos, gerir/criar/eliminar
- **Streams simultâneos** — Free=1 · Premium=2 (env configurável); heartbeat 30s
- **Maturidade** — filtro de catálogo/play por `maturity_max` do perfil
- **Ready** — `GET /ready` (postgres + bunny)

## Auth · Sessões · Deep links · A Minha Lista

- Access JWT curto (`JWT_EXPIRES_IN=15m`) + refresh rotativo (`REFRESH_TOKEN_DAYS=30`)
- Sessões em `auth_sessions` com `sid` no JWT — revogar no servidor invalida o access
- `POST /api/auth/refresh` · `GET/DELETE /api/auth/sessions` · `POST .../revoke-others`
- Deep link de partilha: `GET /api/catalog/share/:id` → UI `/title/:id`
- **A Minha Lista** `/my-list` + link no Navbar
- Métricas ops: `GET /metrics` (users, sessões, streams live, pagamentos, plays)

## Parental · Downloads offline · Preferências

- Bloquear títulos por perfil: `POST/DELETE /api/parental/profiles/:id/blocked/:contentId`
- Bloqueios filtrados na Home / detalhes / play (`TITLE_BLOCKED`)
- Downloads offline com licença device-bound: `POST /api/downloads/:contentId`
- Limites: Free=3 · Premium=10 (env); TTL 7d / 30d; TVOD herda fim do aluguer
- URL MP4 assinada Bunny (`signDownload`) — cliente nunca vê API key
- UI `/downloads` · botão download + bloquear na ficha
- Preferências de perfil: autoplay episódio seguinte / pré-visualizações

## Promos · Top 10 Angola · Histórico · Segurança

- Códigos promo: `POST /api/promos/redeem` (seed `ANGOLA7` = 7 dias Premium)
- Admin: `GET/POST /api/admin/promos` · activar/desactivar
- **Top 10 em Angola** na Home (plays `video_started` últimos 7 dias)
- Histórico: limpar tudo / remover item · ocultar de Continuar a assistir
- Alterar palavra-passe: `POST /api/auth/change-password` (revoga outras sessões)

## Novidades & Em Alta · Browse · Webhooks · Flags

- Hub Netflix-style: `GET /api/browse/new-and-hot` → UI `/new-hot`
- Géneros: `GET /api/browse/genres` · `GET /api/browse/genre/:name` → `/browse`
- Bunny webhook: `POST /webhooks/bunny?token=` (`BUNNY_WEBHOOK_SECRET`) → `encoding_status`
- Checkout idempotente: header `Idempotency-Key` (anti-duplicação de comprovativos)
- Feature flags: `checkout_enabled`, `downloads_enabled`, `promos_enabled`, `maintenance_mode`
- Admin: `GET/PATCH /api/admin/feature-flags/:key`

## Planos · Email · Push · Estreias · SEO

- Planos: `GET /api/plans` → UI `/plans` (Free vs Premium)
- Verificação de email no registo · `POST /api/auth/verify-email` → `/verify-email`
- Reenviar: `POST /api/auth/resend-verification` (Conta)
- Push: `POST /api/push/register` → Expo Push API (pagamentos + estreias)
- Job: publica `coming_soon` vencidos + notifica lembretes (`JOBS_INTERVAL_MS`)
- Open Graph: `GET /share/:id` (HTML WhatsApp/Facebook)

## Legal · Privacidade · Pré-visualizações · Smoke

- Termos / Privacidade versionados: `GET /api/legal` · `GET /api/legal/terms|privacy` (JSON ou `?format=html`)
- Consentimento obrigatório no registo (`acceptTerms`) · `POST /api/legal/me/accept`
- Exportação de dados: `POST /api/account/export-data` (JSON, TTL 7d)
- Eliminação de conta com graça 30 dias: `POST /api/account/delete` · cancelar `.../delete/cancel`
- Job `account_purge` soft-delete contas vencidas
- Denúncias: `POST /api/catalog/content/:id/report` · admin `GET/PATCH /api/admin/reports`
- Pré-visualização trailer: `GET /api/catalog/preview/:id` (sem Bunny play)
- Billboard autoplay trailer (web) · hover preview nas filas
- UI `/legal/terms` · `/legal/privacy` · Conta → Privacidade
- Smoke: `npm run smoke`

## Editorial · Autocomplete · QoE · Recibos · Legendas

- Coleções editoriais na Home (`Só na MinhaTela`): `GET /api/browse/collections`
- Admin: `GET/POST /api/admin/editorial` · `PUT .../editorial/:id/items`
- Autocomplete: `GET /api/search/suggest?q=`
- QoE player: `POST /api/watch/qoe` (startup, buffering, error, bitrate)
- Admin QoE: `GET /api/admin/qoe/summary`
- Recibo: `GET /api/payments/transactions/:id/receipt` (JSON/`?format=html`)
- Preferências de perfil: áudio · legendas · tamanho (`preferredAudio`, `preferredSubtitles`, `subtitleSize`)

## Help · Tickets · Avatares · Advisories · Referrals · Ops

- Centro de Ajuda: `GET /api/support/help` · UI `/help` (FAQ + tickets)
- Tickets: `POST /api/support/tickets` · admin `GET/PATCH /api/admin/tickets`
- Galeria de avatares Angola: `GET /api/support/avatars`
- Advisories de conteúdo na ficha (`linguagem`, `violencia`, …)
- Indicações: `GET /api/support/referral` · `POST .../redeem` (+7 dias Premium a ambos)
- Ops deep ready: `GET /ready` · `GET /ops` (filas, QoE 1h, manutenção)

## Watch Together · Cast · Feedback · Capítulos · Ainda a ver?

- Salas sincronizadas: `POST /api/watch-together/rooms` · join · sync · end
- UI `/watch-together` · botão pessoas no player e na ficha
- Elenco/pessoas: `GET /api/catalog/people/:slug` · UI `/person/:slug`
- Capítulos: `GET /api/catalog/content/:id/chapters`
- Feedback 1–5 + NPS: `POST /api/watch-together/feedback`
- Desafio «Ainda está a ver?»: `POST /api/watch-together/still-watching`

## Presentes · Agregado familiar · Acessibilidade · Estreias · Mais como isto

- Presentes Premium: `POST /api/gifts` · `POST /api/gifts/redeem` · UI `/gifts`
- Admin presentes: `GET/POST /api/admin/gifts` · `PATCH .../revoke`
- Agregado familiar: `GET/POST /api/household` · invite · accept · leave
- Membro herda Premium do titular (SVOD via `premiumSource: household`)
- Acessibilidade no perfil: reduced motion · alto contraste · audiodescrição · texto maior
- Hub Estreias: `GET /api/premieres` · remind · UI `/premieres` · nav «Estreias»
- Mais como isto: `GET /api/catalog/content/:id/more-like-this` · rail no player (créditos)

## Para si · Originais · Não tenho interesse · Recap · Alertas

- Hub Para si: `GET /api/me/for-you` · UI `/for-you` · nav «Para si»
- Não tenho interesse: `POST/DELETE /api/me/titles/:id/not-interested` (filtrado na Home/recs)
- Marcar como visto: `POST/DELETE /api/me/titles/:id/mark-watched`
- Originais MinhaTela: flag `is_original` · fila na Home · badge ORIGINAL
- Saltar recap: `recap_end_seconds` no player (`skipRecapEnabled`)
- Qualidade preferida · downloads só Wi‑Fi · alertas de novo login (email + push)
- Login em dispositivo novo → notificação de segurança

## Rede · WhatsApp · Seguir série · Idiomas · Facturas

- Diagnóstico de rede: `POST /api/network/diagnostics` · UI `/network` (qualidade recomendada AO)
- Partilha WhatsApp: `GET /api/catalog/content/:id/share/whatsapp` · botão na ficha
- Seguir série: `POST/DELETE /api/me/follows/:seriesId` · job novos episódios
- Hub idiomas/categorias: `GET /api/browse/languages` · UI `/languages`
- Facturas: `GET /api/me/invoices` · `GET .../:id?format=html` · UI `/invoices`

## Dispositivos de confiança · PIN no play · A/B · Pesquisas em alta · Pós-créditos

- Dispositivos: `POST /api/account/devices/:id/trust` · `PATCH .../devices/:id` (renomear)
- PIN no play: perfil `requirePinOnPlay` + títulos 16+ · código `PIN_REQUIRED_PLAY`
- Experiências A/B: `GET /api/account/experiments` · admin `GET /api/admin/experiments`
- Pesquisas em alta AO: `GET /api/search/trending` · UI Pesquisa
- Áudio/legendas no player: `PATCH /api/account/playback-prefs`
- Créditos / pós-créditos: `watchCreditsEnabled` · `postCreditsStartSeconds`

## Autoplay countdown · Spoilers · Fraude · Encode · Scrub · OAuth

- Countdown Netflix: `profiles.autoplay_countdown_seconds` no `POST /api/watch/:id/start`
- Anti-spoilers: `hideSpoilers` no perfil · sinopses ocultas em episódios não vistos
- Fraude IBAN/Multicaixa: `risk_score` + `GET /api/admin/payments/risk`
- Encoding Bunny: `GET/PATCH /api/admin/encoding`
- Scrub thumbs: `sprite_vtt_url` · `GET /api/catalog/content/:id/scrub`
- OAuth Google/Apple: `POST /api/auth/oauth/google|apple` (`GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID`)

## Packs TVOD · Who's Watching · NPS · Live · CDN · Estrelas · Sync · Stills

- Packs: `GET /api/payments/packs` · checkout `type=pack` · UI `/packs`
- Perfil last-used: `POST /api/account/profiles/:id/select` · badge «ÚLTIMO»
- NPS app: `GET /api/surveys/pending` · `POST /api/surveys/respond`
- Estreia ao vivo: `POST /api/premieres/:eventId/join`
- CDN health: `POST /api/admin/cdn/probe` · `GET /api/admin/cdn/health` · `/ops.bunnyHealth`
- Estrelas 1–5: `POST /api/discovery/:id/rate` `{ stars }`
- Continuar a assistir SYNC cross-device · stills anti-spoiler

## Smart TV · i18n · Bunny

- **Android TV / Fire TV**: Leanback (`LEANBACK_LAUNCHER`) + `mobile/plugins/withAndroidTv.js` · mesmo APK mobile+TV
- **PC web**: `npm run dev:web` · hover + teclado
- **Mobile**: iOS/Android Expo (`ao.minhatela.app`)
- **Foco / D-pad**: `FocusProvider` + `Focusable` (web/TV remote, setas, Enter, Escape)
- **i18n**: PT/EN via `LanguageProvider` — troca no Navbar (`PT`/`EN`)
- **Bunny Token Auth**: SHA-256 no servidor (`BUNNY_TOKEN_AUTH_KEY`); produção com `BUNNY_REQUIRE_TOKEN=true`; opcional `BUNNY_TOKEN_AUTH_WITH_IP=true`
- Player: teclado/remote — ←/→ seek 10s, Esc volta, Space mostra controlos

## Testes

```bash
E2E_DISABLE_RATE_LIMIT=true npm run e2e   # ponta-a-ponta cliente · pagamentos AO · superadmin
npm run smoke
```

## Regras

- Cliente **nunca** liga ao PostgreSQL
- Cliente **nunca** constrói URLs Bunny nem vê `BUNNY_API_KEY`
- TVOD: 48h a partir de `paid_at` (confirmação admin)
- Dinheiro em Kz inteiros
- Cores: `#000000` · `#CE1126` · `#F7D417` · `#FFFFFF`
