# Playback

Única porta: `POST /api/watch/:contentId/start`.

```
auth → perfil owned → conteúdo publicado → PIN/parental
  → entitlementService (rights + paywall)
  → slot de dispositivo → ads decision
  → bunnyService.signPlayback (servidor)
  → HLS no cliente
```

Secrets Bunny nunca saem no frontend. Estreias usam o mesmo motor com `modality=live` quando há `content_id`.
