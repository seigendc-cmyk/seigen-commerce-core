Recommended module layout (no UI in Pack):

- `src/modules/consignment-bi/`
  - `types.ts` (row/types + enums)
  - `consignment-bi.repo.ts` (Supabase access + mappers)
  - `consignment-bi-ingest.service.ts` (Brain event handlers → insert movements / flags / scores)
  - `consignment-bi-scoring.service.ts` (compute agent score snapshots; scheduled job later)
  - `consignment-bi-risk.service.ts` (derive risk flags from movement patterns)
  - `index.ts` (exports)

Integration points:
- `src/modules/brain/` emits events (already used by CashPlan, approvals, reserves).
- Pack 9 federation overlays can later apply to risk rules / scoring thresholds using `governance_asset_scopes`.

