# Deploy · MinhaTela (GitHub → Railway + Vercel)

Arquitectura de produção:

```text
GitHub (monorepo)
   ├─ Railway  → PostgreSQL + API (server/)
   └─ Vercel   → Web Expo (mobile/)
```

## 1. GitHub

```bash
cd MinhaTela
git init
git add .
git commit -m "chore: prepare Railway + Vercel deploy"
# Cria o repo em github.com e:
git remote add origin git@github.com:SEU_USER/minhatela.git
git branch -M main
git push -u origin main
```

Não faças commit de `.env` (já está no `.gitignore`).

## 2. Railway (API + Postgres)

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Selecciona `minhatela`
3. **Add Plugin** → **PostgreSQL** (cria `DATABASE_URL` automaticamente)
4. No serviço da API (ou cria um a partir do repo):
   - **Settings → Root Directory:** `/` (raiz)
   - **Settings → Builder:** Dockerfile (`server/Dockerfile` via `railway.toml`)
5. **Variables** (além de `DATABASE_URL` do Postgres):

| Variável | Exemplo / notas |
|----------|-----------------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | string longa aleatória |
| `JWT_EXPIRES_IN` | `15m` |
| `REFRESH_TOKEN_DAYS` | `30` |
| `CORS_ORIGIN` | `https://teu-app.vercel.app` (vários: separados por vírgula) |
| `APP_PUBLIC_URL` | `https://teu-app.vercel.app` |
| `API_BASE_URL` | URL pública Railway (ex. `https://minhatela-api.up.railway.app`) |
| `BUNNY_*` | conforme Bunny Stream |
| `PLATFORM_*` / preços | opcional |
| `SEED_ON_BOOT` | `true` só no **primeiro** deploy (depois `false`) |
| `SUPERADMIN_EMAIL` | `minhatela2026@gmail.com` |
| `SUPERADMIN_PASSWORD` | a tua senha forte |
| `SUPERADMIN_NAME` | `Super Admin MinhaTela` |

6. **Generate Domain** no serviço API → copia a URL HTTPS
7. Healthcheck: `GET /health` (já configurado em `railway.toml`)

Migrate corre automaticamente no boot (`server/scripts/start.sh`).  
Seed (catálogo + superadmin) corre se `SEED_ON_BOOT=true`.

Seed manual (one-off no Railway):

```bash
railway run --service api npm --prefix server run seed
```

## 3. Domínios de produção

| Uso | Domínio |
|-----|---------|
| Web (principal) | `https://minhatela.net` (+ `www`) |
| Web (Angola) | `https://minhatela.ao` (+ `www`) |
| API | `https://api.minhatela.net` |

**DNS (no registo do domínio):**

- Apex `minhatela.net` / `minhatela.ao` → Vercel `A` `216.198.79.1` (confirmar no painel Domains)
- `www` → CNAME Vercel (ver Domains no projecto)
- `api.minhatela.net` → CNAME `d27h9ra1.up.railway.app`
- Verificação Railway (TXT): `_railway-verify.api` → `railway-verify=…` (ver `railway domain status`)
- Emails: cria `noreply@` / `support@` / `contato@` e preenche `SMTP_*` no Railway

## 4. Vercel (Web)

1. Project `minhatela` · Root Directory `mobile`
2. **Environment Variables:**

| Variável | Valor |
|----------|--------|
| `EXPO_PUBLIC_API_BASE_URL` | `https://api.minhatela.net` |
| `EXPO_PUBLIC_APP_PUBLIC_URL` | `https://minhatela.net` |

3. **Domains:** `minhatela.net`, `www.minhatela.net`, `minhatela.ao`, `www.minhatela.ao`
4. Railway já tem `CORS_ORIGIN` + `APP_PUBLIC_URL` para `.net` / `.ao`

## 5. Ordem recomendada

1. Push GitHub  
2. Railway (Postgres + API + `api.minhatela.net`)  
3. Vercel + domínios web  
4. DNS nos registos  
5. SMTP + Bunny + IBAN  
6. Login superadmin  

## 5. Checklist pós-deploy

- [ ] `https://API/health` → `{ "status": "ok" }`
- [ ] `https://API/ready` → ready
- [ ] Site Vercel carrega
- [ ] Login `SUPERADMIN_EMAIL` / password
- [ ] Admin `/admin` acessível
- [ ] `SEED_ON_BOOT=false` após primeiro seed

## Notas

- Uploads em `server/uploads` são efémeros no Railway — em produção usa Bunny/S3.
- Node **20** (`.nvmrc` + engines).
- CI em `.github/workflows/ci.yml` valida API + export web em cada push.
