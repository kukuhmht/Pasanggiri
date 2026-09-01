# Event Status Consistency Bugfix Design

## Overview

Public "Pasanggiri Terbuka" events never persist a status column. The status
("Belum Dilaksanakan" / "Akan Dilaksanakan" / "Sedang Berlangsung" / "Sudah
Selesai") is always derived at request time from the event's `gelanggang` and
`penilaian` data. Today that derivation lives in two independent, copy-pasted
places:

- `apps/web/src/lib/event-status.ts` → `getEventStatus(db, eventId)` — used by the
  daftar page (via `/api/public/[orgSlug]/[eventSlug]`) and by the peserta APIs
  that gate registration.
- `apps/web/src/app/api/public-events/route.ts` → inline logic inside `.map()` —
  used by the public event list.

Because the rules are duplicated, the list and the daftar page can disagree
about the same event (Issue 1). Separately, neither location knows about the
owning organization's expiry, so an event owned by an expired account keeps
showing "Sedang Berlangsung" instead of being treated as finished (Issue 2).

The fix extracts a single pure function, `deriveEventStatus(...)`, that encodes
the derivation rules exactly once. Both `getEventStatus` (single event) and the
public-events batch route call it, guaranteeing identical output everywhere. The
pure function additionally accepts an `orgExpired` flag: when the derived status
would be "Sedang Berlangsung" and the org is expired, it returns "Sudah Selesai"
instead — and nothing else changes. The approach is minimal and targeted: the
derivation rules themselves are preserved verbatim; only their location and the
new expiry input change.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — a public event whose
  status is derived inconsistently across call sites, and/or an event owned by an
  expired org whose "Sedang Berlangsung" status is not downgraded.
- **Property (P)**: The desired behavior — every call site derives the identical
  status from one shared function, and org expiry downgrades "Sedang Berlangsung"
  to "Sudah Selesai".
- **Preservation**: The four base derivation rules (peserta aktif → berlangsung;
  antrian → akan; penilaian → selesai; nothing → belum) and the daftar/403 gating
  behavior must remain byte-for-byte identical for all inputs where the org is not
  expired.
- **deriveEventStatus**: The new pure function in `lib/event-status.ts` that maps a
  set of boolean facts (`hasGelanggang`, `hasPesertaAktif`, `hasAntrian`,
  `hasPenilaian`, `orgExpired`) to a status string. Single source of truth.
- **getEventStatus**: The existing async function in `lib/event-status.ts`. After the
  fix it fetches gelanggang + penilaian (as today) plus the owning org's expiry
  facts, then delegates the decision to `deriveEventStatus`.
- **orgExpired**: A boolean derived from the owning organization's `status` and
  `berlaku_hingga`: true when `status` is `'expired'` or `'suspended'`, OR when
  today's date is past `berlaku_hingga` (see `org-status.ts`).

## Bug Details

### Bug Condition

The bug manifests in two ways. First, when the same public event is resolved
through two different endpoints, the duplicated derivation logic can produce
different status strings. Second, when an event's data would derive to "Sedang
Berlangsung" but the owning organization is expired, the derivation has no
knowledge of org expiry and therefore fails to downgrade the status to "Sudah
Selesai".

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type {
           hasGelanggang: boolean,
           hasPesertaAktif: boolean,
           hasAntrian: boolean,
           hasPenilaian: boolean,
           orgExpired: boolean,
           derivedBy: 'shared' | 'inline'   // which code path produced the status
         }
  OUTPUT: boolean

  // Case A: the status was produced by the duplicated inline path in
  // public-events/route.ts rather than the shared source of truth, so it can
  // drift from what the daftar page / peserta APIs compute.
  inconsistentSource := (input.derivedBy == 'inline')

  // Case B: the org is expired and the base derivation is "Sedang Berlangsung",
  // but the current code cannot see orgExpired and leaves it as "Sedang
  // Berlangsung".
  missedExpiryDowngrade := input.hasPesertaAktif AND input.orgExpired

  RETURN inconsistentSource OR missedExpiryDowngrade
END FUNCTION
```

### Examples

- **Inconsistent source (Issue 1).** An event has gelanggang + penilaian rows but no
  peserta aktif and no antrian. The daftar route (`getEventStatus`) returns
  "Sudah Selesai" and shows "Pendaftaran telah ditutup. Event sudah selesai.",
  while a race/edit or divergent code path in the list could report a different
  label. Expected: both report the same status from one function.
- **Missed expiry downgrade (Issue 2).** An event has a gelanggang with
  `peserta_aktif_id` set (→ base "Sedang Berlangsung") but the owning org's
  `berlaku_hingga` is yesterday. Current: shows "Sedang Berlangsung". Expected:
  shows "Sudah Selesai".
- **Missed expiry downgrade via status.** Base derivation "Sedang Berlangsung", org
  `status = 'suspended'`. Current: "Sedang Berlangsung". Expected: "Sudah Selesai".
- **Edge case — expired org, not berlangsung.** Event has antrian only (base "Akan
  Dilaksanakan") and org is expired. Expected: still "Akan Dilaksanakan" — org
  expiry ONLY downgrades "Sedang Berlangsung", never other statuses.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When the org is not expired, status is derived purely from gelanggang + penilaian
  using the existing four rules (peserta aktif → "Sedang Berlangsung"; gelanggang +
  antrian → "Akan Dilaksanakan"; gelanggang + penilaian → "Sudah Selesai";
  otherwise → "Belum Dilaksanakan"), in exactly this precedence order.
- The daftar page must continue to show "Pendaftaran telah ditutup. Event sudah
  selesai." whenever the derived status is "Sudah Selesai".
- The peserta APIs (`peserta`, `peserta/[pid]`, `peserta/[pid]/restore`) must
  continue to return 403 for public callers when the derived status is "Sudah
  Selesai".
- Org expiry must ONLY downgrade "Sedang Berlangsung" → "Sudah Selesai". It must not
  change "Akan Dilaksanakan", "Belum Dilaksanakan", or an already "Sudah Selesai"
  status.
- The public-events list response shape (`{ ...event, status }`), its search
  filtering, and its pagination must remain unchanged.

**Scope:**
All inputs where the org is NOT expired should produce byte-for-byte identical
status output to the current code. This includes:
- Events with no gelanggang and no penilaian.
- Events with antrian, with penilaian, or with peserta aktif.
- Any non-expired org regardless of `status` value ('active', 'trial', etc.).

## Hypothesized Root Cause

Based on the bug analysis, the causes are:

1. **Duplicated derivation logic (Issue 1)**: The same rules are implemented twice —
   once in `lib/event-status.ts` and once inline in `api/public-events/route.ts`.
   Any divergence (present or future) between the two copies produces inconsistent
   statuses for the same event. There is no single source of truth.

2. **No org-expiry input to derivation (Issue 2)**: `getEventStatus(db, eventId)`
   only queries `gelanggang` and `penilaian`. It never loads the owning
   organization's `status` / `berlaku_hingga`, so it structurally cannot apply the
   "expired org downgrades Sedang Berlangsung" rule.

3. **Batch route lacks org expiry data**: `api/public-events/route.ts` selects
   `organizations(nama, slug)` but not `organizations(status, berlaku_hingga)`, so
   even after unifying the logic the batch path has no data to compute `orgExpired`.

## Correctness Properties

Property 1: Bug Condition - Consistent, Expiry-Aware Derivation

_For any_ input where the bug condition holds (isBugCondition returns true), the
fixed code SHALL produce a status computed by the single shared `deriveEventStatus`
function, and when the base derivation is "Sedang Berlangsung" and `orgExpired` is
true the returned status SHALL be "Sudah Selesai"; the public list, daftar page,
and peserta gating SHALL all return the identical status for identical event data.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Non-Expired Derivation Unchanged

_For any_ input where the bug condition does NOT hold (isBugCondition returns
false) — specifically any event whose org is not expired — the fixed
`deriveEventStatus` SHALL produce exactly the same status as the original
derivation logic, preserving the four base rules and their precedence, and the
daftar/403 gating behavior SHALL remain unchanged.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/web/src/lib/org-status.ts`

**Function**: new `isOrgExpired(org)`

1. **Add a shared expiry predicate**: Add `isOrgExpired(org: { status: string;
   berlaku_hingga: string | null } | null | undefined): boolean` returning
   `!org ? false : (org.status === 'expired' || org.status === 'suspended' ||
   isExpiredByDate(org.berlaku_hingga))`. This centralizes the "expired" definition
   given in the requirements and reuses the existing `isExpiredByDate`. (A null org
   is treated as not-expired so that missing org data never fabricates a downgrade.)

**File**: `apps/web/src/lib/event-status.ts`

**Function**: new pure `deriveEventStatus`; updated `getEventStatus`

2. **Extract the pure decision function**:
   ```
   deriveEventStatus({ hasGelanggang, hasPesertaAktif, hasAntrian, hasPenilaian, orgExpired })
   ```
   Body encodes the existing precedence, then applies the expiry downgrade:
   ```
   if (hasPesertaAktif) return orgExpired ? 'Sudah Selesai' : 'Sedang Berlangsung'
   if (hasGelanggang && hasAntrian) return 'Akan Dilaksanakan'
   if (hasGelanggang && hasPenilaian) return 'Sudah Selesai'
   return 'Belum Dilaksanakan'
   ```
   The downgrade is applied ONLY on the "Sedang Berlangsung" branch, satisfying 3.6.

3. **Update `getEventStatus` to load org expiry and delegate**: Query the event's
   `org_id` and the owning organization's `status` + `berlaku_hingga` (e.g. select
   `org_id, organizations(status, berlaku_hingga)` from `events` by id, or a small
   join), in parallel with the existing gelanggang/penilaian queries. Compute
   `orgExpired = isOrgExpired(org)` and return
   `deriveEventStatus({ ...facts, orgExpired })`. The gelanggang/penilaian fact
   extraction stays identical to today.

**File**: `apps/web/src/app/api/public-events/route.ts`

**Function**: `GET`

4. **Select org expiry fields**: Change the events select from
   `organizations(nama, slug)` to `organizations(nama, slug, status, berlaku_hingga)`
   so each event carries its owning org's expiry facts.

5. **Replace inline derivation with the shared function**: In the `.map()`, delete
   the inline `if/else if` status block and call
   `deriveEventStatus({ hasGelanggang, hasPesertaAktif, hasAntrian, hasPenilaian,
   orgExpired: isOrgExpired(event.organizations) })`. Keep the batch fetching of
   gelanggang/penilaian and the fact extraction as-is; only the decision is
   delegated. Response shape, filtering, and pagination are untouched.

**Peserta APIs and daftar route**: No signature changes needed — they already call
`getEventStatus(db, eventId)`, which now transparently accounts for org expiry.

## Testing Strategy

### Validation Approach

The project has no test framework; verification is `tsc --noEmit` plus manual
reasoning, consistent with prior specs. The strategy below is expressed as the
conditions we reason through: first confirm the counterexamples reproduce on the
unfixed code, then confirm the fix satisfies the fix and preservation checks.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the
fix. Confirm or refute the root cause analysis. If we refute, we re-hypothesize.

**Test Plan**: Trace the two endpoints and the peserta gating by hand against sample
event/org data, and confirm the divergence and the missed downgrade. Because there
is no test runner, this is reasoned reproduction rather than executed tests.

**Test Cases**:
1. **Duplicated-source divergence**: Confirm `public-events/route.ts` derives status
   with its own inline block, independent of `getEventStatus` (will diverge on
   unfixed code if either copy changes).
2. **Expired org, peserta aktif**: Event with `peserta_aktif_id` set, org
   `berlaku_hingga` in the past → `getEventStatus` returns "Sedang Berlangsung" on
   unfixed code (should be "Sudah Selesai").
3. **Suspended org, peserta aktif**: Same but org `status = 'suspended'` → returns
   "Sedang Berlangsung" on unfixed code.
4. **Edge case — expired org, antrian only**: Org expired, base "Akan Dilaksanakan"
   → should remain "Akan Dilaksanakan" (confirms downgrade must not over-apply).

**Expected Counterexamples**:
- The batch list and `getEventStatus` compute status through separate code, so they
  are not guaranteed equal.
- Expired-org events with peserta aktif report "Sedang Berlangsung".
- Possible causes: duplicated logic, missing org-expiry input, batch route missing
  org expiry columns.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed
function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := deriveEventStatus(input)   // via getEventStatus and the batch route
  ASSERT (input.hasPesertaAktif AND input.orgExpired) IMPLIES result == 'Sudah Selesai'
  ASSERT statusFrom('list', event) == statusFrom('daftar', event)   // same source
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the
fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  // org not expired ⇒ base rules apply unchanged
  ASSERT deriveEventStatus(input) == originalDerivation(input.gelanggang, input.penilaian)
END FOR
```

**Testing Approach**: Property-based testing would be ideal here (generate random
fact combinations with `orgExpired = false` and assert equality with the original
rules), but since the project has no test framework this is verified by exhaustive
manual case analysis over the small boolean input space (the four
gelanggang/penilaian facts × `orgExpired`).

**Test Plan**: Enumerate every combination of `hasGelanggang`, `hasPesertaAktif`,
`hasAntrian`, `hasPenilaian` with `orgExpired = false` and confirm `deriveEventStatus`
matches the current `if/else` output for both existing implementations.

**Test Cases**:
1. **Mouse-equivalent base rules**: For `orgExpired = false`, verify all four rules
   and precedence match the original code exactly.
2. **Daftar gating preserved**: Verify "Sudah Selesai" still yields the daftar closed
   message and 403 on peserta APIs.
3. **Non-berlangsung expiry no-op**: Verify expired org does not alter "Akan
   Dilaksanakan", "Belum Dilaksanakan", or "Sudah Selesai".

### Unit Tests

- (If a framework is later added) Test `deriveEventStatus` across all fact
  combinations with `orgExpired` both true and false.
- Test the expiry downgrade only fires on the "Sedang Berlangsung" branch.
- Test `isOrgExpired` for status-based and date-based expiry and for null org.

### Property-Based Tests

- Generate random fact combinations with `orgExpired = false` and assert
  `deriveEventStatus` equals the original derivation (preservation).
- Generate random facts with `hasPesertaAktif = true, orgExpired = true` and assert
  output is always "Sudah Selesai" (fix).
- Generate random org `status`/`berlaku_hingga` pairs and assert `isOrgExpired`
  matches the specified expiry definition.

### Integration Tests

- Resolve the same event via `/api/public-events` and
  `/api/public/[orgSlug]/[eventSlug]` and assert identical `status`.
- Attempt public peserta registration on a "Sudah Selesai" event and assert 403.
- Load the list and daftar page for an expired-org event with peserta aktif and
  assert both show "Sudah Selesai".
