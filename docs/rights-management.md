# Rights management

Tabela existente: `content_rights` (território, janela, AVOD/SVOD/TVOD, exclusivo, status).

Extensão 029: `tenant_id`, `rights_owner_id`, `allow_live`.

Motor: `server/src/services/rightsService.js` → `canDistribute()`.

- Sem linhas para o título: **legado permitido** (não quebrar catálogo já publicado).
- Com linhas: exige `status=active`, território, `starts_at ≤ now < ends_at`, e flag da modalidade.
- Admin: `GET/POST/PATCH /api/admin/rights` (`rights.manage`).
