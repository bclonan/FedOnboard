# FedOnboard Main XState Machine

`src/fedOnboardMachine.ts` contains a single, reusable machine that models the core onboarding track with:

- scoped candidacy record context
- clearance-path branching
- idempotent action queueing
- human approval gates
- least-exposure unified sync projections by role
- background reference callouts and mock question sets

## State flow (high-level)

`scopeDraft -> classification -> documentRequest -> fingerprintEnrollment? -> questionnairePending -> referencesWorkflow -> interimReview? -> fullClearance -> finalOfferPending -> finalOfferReview -> eodConfirmed -> provisioning -> pivFlow -> equipment -> orientation -> ethics -> disclosureCheck -> complete`

Optional branches are driven by `clearanceConfig`.

## Clearance path behavior

`CLEARANCE_PATH_CONFIG` drives required forms and branch behavior:

- `NON_SENSITIVE` -> SF-85
- `PUBLIC_TRUST_MODERATE` / `PUBLIC_TRUST_HIGH` -> SF-85P
- `NATIONAL_SECURITY_SECRET` / `NATIONAL_SECURITY_TOP_SECRET` -> SF-86

## Idempotent actions

Every action is queued using deterministic key material:

`hash(scopeId | actionType | target | stablePayload)`

This prevents duplicate side effects across retries and replays.

## Unified sync / least exposure

`buildRoleSyncView` emits role-filtered projections (candidate, security, etc.) with:

- visible fields
- redacted fields
- allowed actions
- projection hash

Use these views for downstream dashboards/APIs rather than exposing full scope context.
