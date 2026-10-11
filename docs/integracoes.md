# Ligações a terceiros · MinhaTela

Quando o contrato ou a conta estiver pronta, cola as variáveis no Railway (API) e no Vercel (web). A consola SuperAdmin → **Ligações** mostra o que já está ligado, sem passwords.

Webhook base (produção): `https://api.minhatela.net`  
Até o DNS: `https://minhatela-production.up.railway.app`

## 1. Email (SMTP)

1. Criar `noreply@minhatela.net` (Resend, Mailgun, SES ou SMTP do domínio).
2. Railway:

```
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=MinhaTela <noreply@minhatela.net>
```

O reset de palavra-passe em produção recusa se o SMTP não estiver definido.

## 2. Google

1. Google Cloud → OAuth 2.0 Client (Web). Origens: `https://minhatela.net`, `https://minhatela.ao`.
2. Railway: `GOOGLE_CLIENT_ID` (+ secret se precisares).
3. Vercel: `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (o mesmo ID público).

O botão só aparece com esta variável no build web.

## 3. Apple

1. Apple Developer → App ID / Services ID.
2. Railway: `APPLE_CLIENT_ID=` (o `aud` do identity token).
3. A API já valida a assinatura nas chaves públicas da Apple. Sem este ID, o login Apple fica desligado.

## 4. Bunny Stream (já usamos)

1. Library ID + AccessKey no Railway (`BUNNY_LIBRARY_ID`, `BUNNY_API_KEY`, `BUNNY_CDN_HOSTNAME`).
2. Token Auth: `BUNNY_TOKEN_AUTH_KEY`, `BUNNY_REQUIRE_TOKEN=true`.
3. Webhook no painel Bunny → `POST {API}/webhooks/bunny?token={BUNNY_WEBHOOK_SECRET}`.
4. DRM (quando o plano Bunny tiver Widevine/FairPlay): no painel Bunny + `BUNNY_DRM_ENABLED=true`.
5. Criadores: a API devolve sessão TUS (`upload.tus`) + link da biblioteca. O ficheiro sobe no Bunny.

## 5. Pagamento instantâneo (PSP)

O checkout **já funciona** com IBAN + comprovativo na consola.

Quando o prestador (AppyPay / EMIS / ProxyPay / Multicaixa Express) entregar a API:

```
PSP_PROVIDER=appy
PSP_API_BASE_URL=
PSP_API_KEY=
PSP_WEBHOOK_SECRET=
```

Webhook a indicar ao prestador:

`POST {API}/webhooks/payments/{provider}`  
Cabeçalho: `x-webhook-token: {PSP_WEBHOOK_SECRET}`

Os eventos ficam gravados. O mapeamento “pago → Premium” liga-se neste ficheiro: `server/src/services/paymentPspService.js` (`handleWebhook`).

## 6. Lojas (EAS)

```
cd mobile
npx eas-cli login
npx eas-cli init
```

Colar o UUID em `EXPO_PUBLIC_EAS_PROJECT_ID` (EAS + Vercel). Depois: `eas build --platform android` / `ios`.
