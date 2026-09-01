# Blank Dashboard Specific Account Bugfix Design

## Overview

User `dedehermansyah452@gmail.com` mengalami halaman dashboard blank setelah login, sementara akun lain normal. Root cause: `getAuthContext()` di `lib/auth.ts` menggunakan `.single()` untuk query memberships — jika user tidak punya membership atau punya lebih dari satu, query gagal dan return `null`. Layout admin (`layout.tsx`) memeriksa `if (!ctx) redirect('/login')`, tapi user sudah authenticated, sehingga terjadi redirect loop `/app` → `/login` → `/app` → blank page.

Fix approach: Memisahkan state "not authenticated" dan "authenticated but no membership" di `getAuthContext()`, lalu menangani masing-masing state secara berbeda di layout dan page — menampilkan halaman error informatif alih-alih redirect loop.

## Glossary

- **Bug_Condition (C)**: User terautentikasi tapi `getAuthContext()` return `null` karena query membership gagal (tidak ada membership atau lebih dari satu membership) — menyebabkan redirect loop
- **Property (P)**: User terautentikasi tanpa membership yang valid harus melihat halaman error informatif, bukan blank page/redirect loop
- **Preservation**: User normal (1 membership + org valid) harus tetap melihat dashboard seperti biasa, user tidak terautentikasi tetap di-redirect ke login
- **getAuthContext()**: Fungsi di `apps/web/src/lib/auth.ts` yang mengambil user auth + membership + org data dari Supabase
- **AdminLayout**: Layout component di `apps/web/src/app/(admin)/app/layout.tsx` yang menjadi wrapper semua halaman admin
- **AdminDashboard**: Page component di `apps/web/src/app/(admin)/app/page.tsx` yang menampilkan konten dashboard
- **membership**: Record di tabel `memberships` yang menghubungkan user ke organisasi dengan role tertentu
- **OrgContext**: Type yang merepresentasikan data organisasi (id, nama, status, slug, berlaku_hingga)

## Bug Details

### Bug Condition

Bug terjadi ketika user yang sudah terautentikasi (Supabase auth session valid) tidak memiliki record membership yang valid, atau memiliki lebih dari satu record membership. Fungsi `getAuthContext()` menggunakan `.single()` yang mengharuskan tepat satu row — jika 0 atau >1 row, query error dan function return `null`. Layout admin memperlakukan `null` context sama dengan "not authenticated", memicu redirect ke `/login`. Karena user sudah login, `/login` redirect balik ke `/app`, menciptakan infinite redirect loop.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { user: SupabaseUser, membershipCount: number, orgData: OrgContext | null }
  OUTPUT: boolean

  RETURN input.user IS NOT NULL
         AND (input.membershipCount == 0
              OR input.membershipCount > 1
              OR (input.membershipCount == 1 AND input.orgData IS NULL))
END FUNCTION
```

### Examples

- **No membership**: User `dedehermansyah452@gmail.com` login → `getAuthContext()` query memberships → 0 rows → `.single()` error → return `null` → layout redirect `/login` → user sudah login → redirect `/app` → loop → blank page
- **Duplicate membership**: User punya 2 record di tabel memberships (misal pernah di-assign ke 2 org) → `.single()` error karena >1 row → return `null` → redirect loop → blank page
- **Null org data**: User punya 1 membership tapi foreign key ke organizations gagal (org dihapus) → `membership.organizations` null → `org.berlaku_hingga` crash → blank page
- **Normal case (not buggy)**: User punya tepat 1 membership dengan org valid → `.single()` sukses → dashboard tampil normal

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- User dengan 1 membership + org data lengkap harus tetap melihat dashboard lengkap (sidebar, welcome, feature cards)
- User yang belum login (no Supabase auth session) harus tetap di-redirect ke `/login`
- User dengan org status `active`/`trial` yang belum expired harus tetap melihat dashboard penuh
- User dengan org status `expired`/`suspended` harus tetap melihat TrialInfoCard tanpa akses fitur
- Grace period logic tetap berjalan seperti biasa
- SuperAdmin detection berdasarkan email tetap berfungsi

**Scope:**
Semua input yang TIDAK melibatkan bug condition (user tanpa membership, duplicate membership, atau null org) harus sepenuhnya tidak terpengaruh oleh fix ini. Termasuk:
- Login/logout flow untuk user normal
- Semua operasi CRUD di dashboard (events, gelanggang, penilaian, dll)
- Sidebar navigation dan routing
- Trial/subscription status handling

## Hypothesized Root Cause

Berdasarkan analisis kode, root cause yang paling mungkin:

1. **`.single()` query pattern yang fragile**: `getAuthContext()` menggunakan `.single()` pada query memberships. Method ini throw error jika hasilnya bukan tepat 1 row. Untuk user tanpa membership (baru register, belum di-assign org) atau dengan duplicate membership, query ini gagal.
   - File: `apps/web/src/lib/auth.ts`, line 21
   - `.single()` return `{ data: null, error: ... }` jika 0 atau >1 rows

2. **Tidak ada differensiasi antara "not authenticated" dan "no membership"**: `getAuthContext()` return `null` untuk kedua kasus — baik user belum login maupun user login tapi tanpa membership. Layout admin memperlakukan keduanya sama: redirect ke `/login`.
   - File: `apps/web/src/app/(admin)/app/layout.tsx`, line 8
   - `if (!ctx) redirect('/login')` — tidak bisa membedakan alasan ctx null

3. **Redirect loop karena auth check di login page**: Ketika user yang sudah authenticated di-redirect ke `/login`, halaman login kemungkinan mendeteksi session yang valid dan redirect balik ke `/app`, menciptakan infinite loop.

4. **Null org data tidak ditangani sebelum akses properti**: Jika membership ada tapi `organizations(*)` return null (org dihapus), kode `org.berlaku_hingga` di line 27 akan crash karena `org` null di-cast sebagai `OrgContext`.
   - File: `apps/web/src/lib/auth.ts`, line 24-25

## Correctness Properties

Property 1: Bug Condition - Authenticated User Without Valid Membership Shows Error Page

_For any_ input where the user is authenticated but has no valid membership (isBugCondition returns true — 0 memberships, >1 memberships, or null org data), the fixed system SHALL display an informative error page explaining the situation (e.g., "Akun Anda belum terhubung ke organisasi manapun") without triggering a redirect loop, and the page SHALL remain stable (no infinite redirects).

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Normal User Dashboard Behavior

_For any_ input where the user has exactly one valid membership with complete org data (isBugCondition returns false), the fixed system SHALL produce exactly the same rendered output as the original system — dashboard with sidebar, welcome message, feature cards, trial info, and all existing functionality preserved without any behavioral change.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming root cause analysis is correct:

**File**: `apps/web/src/lib/auth.ts`

**Function**: `getAuthContext()`

**Specific Changes**:
1. **Ganti `.single()` dengan `.maybeSingle()` atau handle array**: Gunakan query yang tidak throw error saat 0 rows. Jika >1 rows, ambil yang pertama atau return partial context.
   - Ganti `.single()` dengan query yang lebih toleran
   - Handle kasus 0 membership: return partial context `{ user, org: null, orgId: null, role: null }`
   - Handle kasus >1 membership: ambil membership pertama (atau yang paling recent)

2. **Return partial context alih-alih null**: Ubah return type untuk membedakan "not authenticated" (`null`) vs "authenticated but no membership" (partial object dengan `org: null`).
   - Return `null` hanya jika `user` null (truly not authenticated)
   - Return `{ user, org: null, orgId: null, role: null }` jika user ada tapi membership tidak

3. **Guard null org sebelum akses properti**: Tambahkan null check sebelum `org.berlaku_hingga` dan `org.status` di grace period logic.
   - `if (org && isPastGracePeriod(org.berlaku_hingga) && ...)` 

**File**: `apps/web/src/app/(admin)/app/layout.tsx`

**Function**: `AdminLayout()`

**Specific Changes**:
4. **Bedakan "not authenticated" vs "no membership"**: 
   - Jika `ctx === null` → redirect ke `/login` (user belum login)
   - Jika `ctx.org === null` → tampilkan halaman error informatif (user login tapi tanpa org)

5. **Tampilkan error page untuk user tanpa organisasi**: Render komponen error yang menjelaskan situasi, dengan opsi logout dan informasi kontak admin.

**File**: `apps/web/src/app/(admin)/app/page.tsx`

**Function**: `AdminDashboard()`

**Specific Changes**:
6. **Sesuaikan null check dengan return type baru**: Update pengecekan `ctx` agar konsisten dengan perubahan di `getAuthContext()`. Handle `org: null` secara graceful.

## Testing Strategy

### Validation Approach

Testing strategy menggunakan dua fase: pertama, surface counterexamples yang menunjukkan bug di kode yang belum diperbaiki, lalu verifikasi bahwa fix bekerja dan mempertahankan behavior yang ada.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples yang menunjukkan bug SEBELUM implementasi fix. Konfirmasi atau sanggah root cause analysis. Jika disanggah, perlu re-hypothesize.

**Test Plan**: Buat mock Supabase client dan test `getAuthContext()` dengan berbagai skenario membership. Jalankan di kode UNFIXED untuk melihat failures.

**Test Cases**:
1. **Zero Membership Test**: Mock user authenticated, memberships query return 0 rows → verify `getAuthContext()` behavior (will return null on unfixed code, causing redirect loop)
2. **Multiple Membership Test**: Mock user dengan 2 memberships → verify `.single()` fails (will return null on unfixed code)
3. **Null Org Test**: Mock user dengan 1 membership tapi `organizations(*)` return null → verify crash saat akses `org.berlaku_hingga` (will crash on unfixed code)
4. **Layout Redirect Test**: Mock `getAuthContext()` return null untuk authenticated user → verify redirect loop behavior (will loop on unfixed code)

**Expected Counterexamples**:
- `getAuthContext()` return `null` untuk user authenticated tanpa membership
- `.single()` throw error untuk user dengan >1 memberships
- Layout redirect ke `/login` meskipun user sudah authenticated
- Possible causes: `.single()` query pattern, tidak ada differensiasi null context, null org property access

### Fix Checking

**Goal**: Verifikasi bahwa untuk semua input dimana bug condition berlaku, fungsi yang diperbaiki menghasilkan behavior yang benar.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := getAuthContext_fixed(input)
  ASSERT result IS NOT NULL  // partial context, bukan null
  ASSERT result.user IS NOT NULL
  ASSERT result.org IS NULL OR result.org is valid OrgContext

  layoutResult := AdminLayout_fixed(result)
  ASSERT layoutResult shows error page, NOT redirect loop
  ASSERT layoutResult contains informative message
END FOR
```

### Preservation Checking

**Goal**: Verifikasi bahwa untuk semua input dimana bug condition TIDAK berlaku, fungsi yang diperbaiki menghasilkan hasil yang sama dengan fungsi asli.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT getAuthContext_original(input) = getAuthContext_fixed(input)
  ASSERT AdminLayout_original(input) renders same output as AdminLayout_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing direkomendasikan untuk preservation checking karena:
- Menghasilkan banyak test case otomatis di seluruh input domain
- Menangkap edge case yang mungkin terlewat oleh unit test manual
- Memberikan jaminan kuat bahwa behavior tidak berubah untuk input non-buggy

**Test Plan**: Observasi behavior di kode UNFIXED terlebih dahulu untuk user normal (1 membership + valid org), lalu tulis property-based test yang menangkap behavior tersebut.

**Test Cases**:
1. **Normal User Preservation**: Verify user dengan 1 membership + org valid tetap mendapat dashboard lengkap setelah fix
2. **Unauthenticated Redirect Preservation**: Verify user tanpa session tetap di-redirect ke `/login`
3. **Expired Org Preservation**: Verify user dengan org expired tetap melihat TrialInfoCard
4. **Grace Period Preservation**: Verify grace period logic tetap berjalan sama

### Unit Tests

- Test `getAuthContext()` dengan 0 memberships → harus return partial context (bukan null)
- Test `getAuthContext()` dengan 1 membership + valid org → harus return full context (sama seperti sebelumnya)
- Test `getAuthContext()` dengan >1 memberships → harus handle gracefully (ambil pertama atau return partial)
- Test `getAuthContext()` dengan 1 membership + null org → harus return partial context
- Test AdminLayout dengan partial context (org null) → harus render error page
- Test AdminLayout dengan full context → harus render dashboard (unchanged)
- Test AdminLayout tanpa auth → harus redirect ke login

### Property-Based Tests

- Generate random user states (authenticated/not, 0/1/N memberships, valid/null/incomplete org) dan verify system tidak pernah mengalami redirect loop
- Generate random valid membership configurations dan verify dashboard output identik dengan behavior sebelum fix
- Generate random org status combinations (active, trial, expired, suspended) dan verify status handling tetap konsisten

### Integration Tests

- Test full login flow untuk user tanpa membership → harus melihat error page setelah login
- Test full login flow untuk user normal → harus melihat dashboard (unchanged)
- Test navigasi antar halaman admin setelah fix untuk memastikan tidak ada regresi
- Test logout dari error page → harus kembali ke login dengan benar
