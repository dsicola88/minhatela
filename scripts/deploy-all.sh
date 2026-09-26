#!/usr/bin/env bash
# MinhaTela · Deploy: GitHub + Railway + Vercel
# Uso (no Terminal.app, fora do Cursor):
#   chmod +x scripts/deploy-all.sh && ./scripts/deploy-all.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REPO_NAME="${REPO_NAME:-minhatela}"
VIS="${REPO_VISIBILITY:-private}"

green(){ printf '\033[32m%s\033[0m\n' "$*"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$*"; }
red(){ printf '\033[31m%s\033[0m\n' "$*"; }
step(){ printf '\n\033[1m==> %s\033[0m\n' "$*"; }

command -v git >/dev/null
command -v gh >/dev/null
command -v railway >/dev/null
command -v openssl >/dev/null
command -v npx >/dev/null
# Evita npm i -g (precisa de sudo); usa npx
vercel() { npx --yes vercel@latest "$@"; }

step "Auth GitHub"
gh auth status -h github.com || gh auth login -h github.com -p https -w

step "Auth Railway"
railway whoami || railway login

step "Auth Vercel"
vercel whoami || vercel login

step "Push GitHub ($REPO_NAME)"
if [[ -n "$(git status --porcelain)" ]]; then
  git add -A
  git commit -m "chore: sync before deploy" || true
fi
if ! git remote get-url origin >/dev/null 2>&1; then
  if [[ "$VIS" == "public" ]]; then
    gh repo create "$REPO_NAME" --public --source=. --remote=origin --push
  else
    gh repo create "$REPO_NAME" --private --source=. --remote=origin --push
  fi
else
  git push -u origin HEAD
fi
REPO_URL="$(gh repo view --json url -q .url)"
green "GitHub: $REPO_URL"

step "Railway project + Postgres + API"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32)}"
SUPERADMIN_EMAIL="${SUPERADMIN_EMAIL:-minhatela2026@gmail.com}"
SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD:-Dpa211088@}"

railway status >/dev/null 2>&1 || railway init -n "$REPO_NAME" || true
railway add --database postgres 2>/dev/null || railway add -d postgres 2>/dev/null || yellow "Postgres: pode já existir"

railway variables set \
  NODE_ENV=production \
  JWT_SECRET="$JWT_SECRET" \
  JWT_EXPIRES_IN=15m \
  REFRESH_TOKEN_DAYS=30 \
  CORS_ORIGIN=true \
  SEED_ON_BOOT=true \
  SUPERADMIN_EMAIL="$SUPERADMIN_EMAIL" \
  SUPERADMIN_PASSWORD="$SUPERADMIN_PASSWORD" \
  SUPERADMIN_NAME="Super Admin MinhaTela" \
  MIGRATIONS_DIR=/database/migrations >/dev/null

railway up --detach || railway up
railway domain 2>/dev/null || true
API_URL="$(railway domain 2>/dev/null | head -1 | tr -d '[:space:]' || true)"
if [[ -n "${API_URL}" && "${API_URL}" != https://* ]]; then API_URL="https://${API_URL}"; fi
if [[ -z "${API_URL}" ]]; then
  read -r -p "URL pública da API Railway: " API_URL
fi
green "API: $API_URL"
railway variables set API_BASE_URL="$API_URL" >/dev/null

for i in $(seq 1 24); do
  curl -fsS "$API_URL/health" >/dev/null 2>&1 && { green "API OK"; break; }
  sleep 5
done

step "Vercel web (mobile/)"
pushd mobile >/dev/null
vercel link --yes --project "$REPO_NAME" 2>/dev/null || vercel link --yes
printf '%s' "$API_URL" | vercel env add EXPO_PUBLIC_API_BASE_URL production 2>/dev/null || true
WEB_OUT="$(vercel --prod --yes)"
echo "$WEB_OUT"
WEB_URL="$(echo "$WEB_OUT" | grep -Eo 'https://[a-zA-Z0-9.-]+\.vercel\.app' | tail -1 || true)"
if [[ -z "${WEB_URL}" ]]; then read -r -p "URL Vercel: " WEB_URL; fi
popd >/dev/null
green "Web: $WEB_URL"

step "CORS no Railway"
railway variables set CORS_ORIGIN="$WEB_URL" APP_PUBLIC_URL="$WEB_URL" SEED_ON_BOOT=false >/dev/null
railway up --detach || railway redeploy 2>/dev/null || true

green "======= FEITO ======="
echo "GitHub : $REPO_URL"
echo "API    : $API_URL"
echo "Web    : $WEB_URL"
echo "Login  : $SUPERADMIN_EMAIL"
