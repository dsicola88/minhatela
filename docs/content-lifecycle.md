# Ciclo de conteúdo

```
CREATE (draft) → UPLOAD Bunny → SUBMIT → ADMIN REVIEW
  → RIGHTS CHECK → QC → APPROVED → BUNNY READY → PUBLISH → CATALOG
```

- Creator / editor **não** publicam nem aprovam o próprio título (`SELF_APPROVAL_FORBIDDEN`).
- `workflow_status` em `videos` continua a ser a máquina de estados.
- `content_format` (movie/series/documentary/short/live/special) é metadado extra; `kind` enum existente (movie/series/episode) não foi reescrito.
- Ownership: `created_by_user_id`, `creator_id`, `production_company_id`, `licensed_by_company_id` / `content_rights.rights_owner_id`.
