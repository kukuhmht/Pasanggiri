# Implementation Plan

- [ ] 1. Explore the bug condition (verify inconsistent + expiry-blind derivation)
  - **Property 1: Bug Condition** - Consistent, Expiry-Aware Derivation
  - **CRITICAL**: This check MUST fail on the unfixed code — failure confirms the bug exists.
  - **DO NOT attempt to fix the code during this step** — only observe and document.
  - **NOTE**: This encodes the expected behavior; it will validate the fix once it holds after implementation.
  - **GOAL**: Surface counterexamples proving the bug from `isBugCondition` in design.
  - **Scoped approach**: The project has no test framework, so reason through concrete failing cases by hand (reasoned reproduction, not an executed test), scoped to deterministic inputs.
  - Trace `getEventStatus(db, eventId)` in `apps/web/src/lib/event-status.ts` and the inline `.map()` derivation in `apps/web/src/app/api/public-events/route.ts`; confirm they are two independent copies of the rules (`derivedBy == 'inline'` path can drift).
  - Concrete counterexample A (missed expiry downgrade): event with a gelanggang where `peserta_aktif_id` is set (base "Sedang Berlangsung") and owning org `berlaku_hingga` in the past → current code returns "Sedang Berlangsung".
  - Concrete counterexample B (missed expiry via status): same base facts but org `status = 'suspended'` → current code returns "Sedang Berlangsung".
  - Concrete counterexample C (source divergence): the list route derives status without ever calling `getEventStatus`, so identical event data is not guaranteed to yield identical status across the list and the daftar page.
  - **EXPECTED OUTCOME**: All three cases reproduce the wrong/at-risk behavior (this is correct — it proves the bug exists).
  - Document the counterexamples found to confirm the root cause (duplicated logic + no org-expiry input + batch route missing org expiry columns).
  - Mark this task complete when the counterexamples are traced and documented.
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Establish the preservation baseline (non-expired derivation unchanged)
  - **Property 2: Preservation** - Non-Expired Derivation Unchanged
  - **IMPORTANT**: Follow the observation-first methodology against the UNFIXED code.
  - Since there is no test runner, enumerate by hand the small boolean input space (`hasGelanggang`, `hasPesertaAktif`, `hasAntrian`, `hasPenilaian`) with `orgExpired = false` and record the status the current code produces for each combination.
  - Observe: peserta aktif → "Sedang Berlangsung" (3.1); gelanggang + antrian, no peserta aktif → "Akan Dilaksanakan" (3.2); gelanggang + penilaian, no peserta aktif, no antrian → "Sudah Selesai" (3.3); no gelanggang, no penilaian → "Belum Dilaksanakan" (3.4), in exactly this precedence order.
  - Observe: derived "Sudah Selesai" currently yields the daftar closed message "Pendaftaran telah ditutup. Event sudah selesai." and a 403 on the peserta APIs for public callers (3.5).
  - Observe: expired org must NOT change "Akan Dilaksanakan", "Belum Dilaksanakan", or an already "Sudah Selesai" status — only "Sedang Berlangsung" downgrades (3.6).
  - **EXPECTED OUTCOME**: This recorded table is the baseline the fix must reproduce byte-for-byte for all non-expired inputs.
  - Mark this task complete when the baseline table and gating behavior are recorded.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Fix inconsistent / expiry-blind event status derivation

  - [ ] 3.1 Add shared org-expiry predicate
    - In `apps/web/src/lib/org-status.ts`, add `isOrgExpired(org: { status: string; berlaku_hingga: string | null } | null | undefined): boolean`.
    - Return `false` for a null/undefined org (missing org data must never fabricate a downgrade); otherwise return `org.status === 'expired' || org.status === 'suspended' || isExpiredByDate(org.berlaku_hingga)`, reusing the existing `isExpiredByDate`.
    - _Bug_Condition: isBugCondition(input) — missedExpiryDowngrade = hasPesertaAktif AND orgExpired_
    - _Expected_Behavior: orgExpired = (status expired/suspended) OR isExpiredByDate(berlaku_hingga); null org → not expired_
    - _Preservation: null org treated as not-expired; expiry definition centralized_
    - _Requirements: 2.3_

  - [ ] 3.2 Extract the pure `deriveEventStatus` decision function
    - In `apps/web/src/lib/event-status.ts`, add `deriveEventStatus({ hasGelanggang, hasPesertaAktif, hasAntrian, hasPenilaian, orgExpired })` as the single source of truth.
    - Encode the existing precedence, applying the expiry downgrade ONLY on the "Sedang Berlangsung" branch:
      `if (hasPesertaAktif) return orgExpired ? 'Sudah Selesai' : 'Sedang Berlangsung'`;
      `if (hasGelanggang && hasAntrian) return 'Akan Dilaksanakan'`;
      `if (hasGelanggang && hasPenilaian) return 'Sudah Selesai'`;
      `return 'Belum Dilaksanakan'`.
    - _Bug_Condition: isBugCondition(input) — inconsistentSource OR missedExpiryDowngrade_
    - _Expected_Behavior: expectedBehavior(result) — downgrade fires only on the Sedang Berlangsung branch; base precedence preserved_
    - _Preservation: four base rules and precedence unchanged for orgExpired = false (3.1, 3.2, 3.3, 3.4, 3.6)_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.6_

  - [ ] 3.3 Refactor `getEventStatus` to load org expiry and delegate
    - In `apps/web/src/lib/event-status.ts`, extend `getEventStatus(db, eventId)` to also fetch the event's `org_id` and the owning organization's `status` + `berlaku_hingga` (e.g. `select org_id, organizations(status, berlaku_hingga)` from `events` by id), alongside the existing gelanggang/penilaian queries.
    - Compute `orgExpired = isOrgExpired(org)` and return `deriveEventStatus({ hasGelanggang, hasPesertaAktif, hasAntrian, hasPenilaian, orgExpired })`. Keep the gelanggang/penilaian fact extraction identical to today.
    - Peserta APIs and the daftar route need no signature change — they already call `getEventStatus(db, eventId)`.
    - _Bug_Condition: isBugCondition(input) — inconsistentSource (daftar/peserta path)_
    - _Expected_Behavior: single shared derivation via deriveEventStatus, now expiry-aware_
    - _Preservation: daftar closed message + peserta 403 gating unchanged (3.5)_
    - _Requirements: 2.1, 2.2, 2.3, 3.5_

  - [ ] 3.4 Replace inline derivation in the public-events batch route
    - In `apps/web/src/app/api/public-events/route.ts`, change the events select from `organizations(nama, slug)` to `organizations(nama, slug, status, berlaku_hingga)`.
    - In the `.map()`, delete the inline `if/else if` status block and call `deriveEventStatus({ hasGelanggang, hasPesertaAktif, hasAntrian, hasPenilaian, orgExpired: isOrgExpired(event.organizations) })`. Keep the batch gelanggang/penilaian fetching and fact extraction as-is.
    - Leave the response shape (`{ ...event, status }`), search filtering, and pagination untouched.
    - _Bug_Condition: isBugCondition(input) — inconsistentSource (inline list path)_
    - _Expected_Behavior: list uses the same deriveEventStatus as getEventStatus; identical event data → identical status_
    - _Preservation: list response shape, filtering, and pagination unchanged_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.5 Verify the bug condition is resolved
    - **Property 1: Expected Behavior** - Consistent, Expiry-Aware Derivation
    - **IMPORTANT**: Re-check the SAME counterexamples from task 1 — do NOT invent new ones.
    - Confirm counterexamples A and B (peserta aktif + expired/suspended org) now derive "Sudah Selesai" through `deriveEventStatus`.
    - Confirm counterexample C: the list route and `getEventStatus` now flow through the one shared function, so identical event data yields identical status.
    - **EXPECTED OUTCOME**: All task-1 counterexamples now produce the correct behavior (bug fixed).
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.6 Verify preservation baseline still holds
    - **Property 2: Preservation** - Non-Expired Derivation Unchanged
    - **IMPORTANT**: Re-check the SAME baseline table from task 2 — do NOT redefine it.
    - Confirm every non-expired combination still maps to the same status (rules 3.1–3.4 and precedence), the daftar closed message + peserta 403 gating are unchanged (3.5), and expiry does not alter non-"Sedang Berlangsung" statuses (3.6).
    - **EXPECTED OUTCOME**: Baseline matches byte-for-byte (no regressions).
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 4. Checkpoint - Verify the build
  - Run `cd apps/web && npx tsc --noEmit` and resolve any type errors introduced by the changes.
  - Confirm the exploration counterexamples (task 3.5) and the preservation baseline (task 3.6) both hold via manual reasoning, since the project has no test framework.
  - Ask the user if any questions or ambiguities arise.
