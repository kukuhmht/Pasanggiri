# Bugfix Requirements Document

## Introduction

For public "Pasanggiri Terbuka" events, an event's status is never stored in the database. It is always derived at request time from the event's `gelanggang` and `penilaian` data. This derivation currently exists as two independent, duplicated copies of the same rules:

1. `apps/web/src/lib/event-status.ts` → `getEventStatus(db, eventId)`, used by the participant registration (daftar) page (via `/api/public/[orgSlug]/[eventSlug]`) and by the peserta APIs that gate registration.
2. `apps/web/src/app/api/public-events/route.ts` → inline logic inside `.map()`, used by the public event list.

Two problems result from this design:

- **Issue 1 — Inconsistent status.** The same event can show one status in the public event list (e.g. "Belum Dilaksanakan") while the daftar page reports a different status ("Pendaftaran telah ditutup. Event sudah selesai." = "Sudah Selesai"). Because the derivation is duplicated, the two locations can disagree.
- **Issue 2 — Expired-account rule missing.** When an event's derived status is "Sedang Berlangsung" but the owning organization/account is already expired, the status should be shown and treated as "Sudah Selesai". The current derivation has no knowledge of the organization's expiry state, so this downgrade never happens.

The fix unifies status derivation into a single shared source of truth used everywhere, and extends that shared derivation to account for the owning organization's expiry status.

## Bug Analysis

### Current Behavior (Defect)

What currently happens when the bug is triggered.

1.1 WHEN the same public event is viewed in the public event list and on the participant registration (daftar) page THEN the system MAY display two different derived statuses (for example "Belum Dilaksanakan" in the list while the daftar page reports "Pendaftaran telah ditutup. Event sudah selesai." i.e. "Sudah Selesai")

1.2 WHEN an event status is needed THEN the system derives it independently in two duplicated locations (`lib/event-status.ts` and the inline logic in `api/public-events/route.ts`), allowing the list and the daftar page to disagree

1.3 WHEN an event's derived status is "Sedang Berlangsung" AND the owning organization is expired THEN the system still displays and treats the event as "Sedang Berlangsung"

### Expected Behavior (Correct)

What should happen instead.

2.1 WHEN the same public event is viewed in the public event list and on the participant registration (daftar) page THEN the system SHALL display the identical derived status, computed from a single shared source of truth

2.2 WHEN an event status is needed anywhere (public list, daftar page, or peserta registration gating) THEN the system SHALL use one shared derivation so all locations are always consistent

2.3 WHEN an event's derived status would be "Sedang Berlangsung" AND the owning organization is expired THEN the system SHALL treat and display the status as "Sudah Selesai"

### Unchanged Behavior (Regression Prevention)

Existing behavior that must be preserved.

3.1 WHEN an event's organization is not expired AND any gelanggang has `peserta_aktif_id` set THEN the system SHALL CONTINUE TO derive "Sedang Berlangsung"

3.2 WHEN an event has gelanggang with non-empty `antrian` AND no peserta aktif THEN the system SHALL CONTINUE TO derive "Akan Dilaksanakan"

3.3 WHEN an event has gelanggang AND penilaian rows AND no peserta aktif AND no antrian THEN the system SHALL CONTINUE TO derive "Sudah Selesai"

3.4 WHEN an event has no gelanggang AND no penilaian THEN the system SHALL CONTINUE TO derive "Belum Dilaksanakan"

3.5 WHEN the derived status is "Sudah Selesai" THEN the daftar page SHALL CONTINUE TO show "Pendaftaran telah ditutup. Event sudah selesai." and the peserta APIs SHALL CONTINUE TO block public registration with a 403

3.6 WHEN the owning organization is not expired THEN the system SHALL CONTINUE TO derive status purely from gelanggang and penilaian data (organization expiry only downgrades "Sedang Berlangsung" to "Sudah Selesai", it does not change any other derived status)
