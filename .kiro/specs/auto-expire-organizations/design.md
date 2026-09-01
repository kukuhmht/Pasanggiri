# Auto Expire Organizations Bugfix Design

## Overview

Organisasi yang sudah melewati tanggal `berlaku_hingga` masih tampil dan diperlakukan sebagai "trial"/"active" di beberapa jalur aplikasi. Ada tiga akar masalah yang saling menguatkan: (1) logika expiry memakai grace period 3 hari sehingga status tidak langsung berubah, (2) cron auto-expire tidak terdaftar di `vercel.json` sehingga tidak pernah berjalan, dan (3) halaman super admin membaca status mentah dari database tanpa rekonsiliasi.

Keputusan pengguna: expiry harus **langsung** (`today > berlaku_hingga`) **tanpa grace period**, dan kondisi ini harus konsisten di semua jalur — lazy-update saat login (`getAuthContext`), cron terjadwal, dan tampilan super admin.

Strategi perbaikan: menyatukan kondisi expiry menjadi satu fungsi tunggal `isExpiredByDate(berlaku_hingga)` = `today > berlaku_hingga`, memakainya di `isOrgActive` dan di lazy-update login, mendaftarkan cron harian di `vercel.json`, serta merekonsiliasi record basi saat halaman super admin dimuat sehingga database tetap konsisten. Fix ini bersifat minimal dan terarah agar tidak mengubah perilaku untuk organisasi yang masih berlaku, suspended, expired, atau tanpa `berlaku_hingga`.

## Glossary

- **Bug_Condition (C)**: Kondisi yang memicu bug — organisasi berstatus `trial`/`active` yang tanggal `berlaku_hingga`-nya sudah terlewati (`today > berlaku_hingga`) namun status efektif/tersimpan tidak menjadi `expired`.
- **Property (P)**: Perilaku yang diharapkan — organisasi tersebut SHALL dianggap tidak aktif dan bernilai status `expired` di semua jalur (login, cron, tampilan super admin).
- **Preservation**: Perilaku yang harus tetap sama — organisasi yang belum lewat tanggal, `suspended`, `expired`, atau tanpa `berlaku_hingga` tidak boleh terpengaruh; otorisasi cron via Bearer `CRON_SECRET` tetap dipertahankan.
- **isExpiredByDate**: Fungsi tunggal baru di `apps/web/src/lib/org-status.ts` yang mengembalikan `true` bila `berlaku_hingga` tidak null dan `today > berlaku_hingga`. Menggantikan peran `isPastGracePeriod` sebagai gerbang expiry.
- **isOrgActive**: Fungsi di `apps/web/src/lib/org-status.ts` yang menentukan apakah organisasi masih aktif.
- **getAuthContext**: Fungsi di `apps/web/src/lib/auth.ts` yang memuat konteks user/organisasi dan melakukan lazy-update status saat login.
- **berlaku_hingga**: Kolom tanggal (`string | null`, format `YYYY-MM-DD`) pada tabel `organizations` yang menandai batas masa berlaku.
- **Grace period**: Toleransi 3 hari (`GRACE_PERIOD_DAYS`) setelah `berlaku_hingga` — dihapus sebagai gerbang expiry sesuai keputusan pengguna.

## Bug Details

### Bug Condition

Bug muncul ketika sebuah organisasi berstatus `trial` atau `active` sudah melewati tanggal `berlaku_hingga` (`today > berlaku_hingga`), tetapi sistem masih memperlakukannya sebagai aktif. Ini terjadi karena `isOrgActive`/lazy-update memakai gerbang grace period (`isPastGracePeriod`, yang baru true setelah `berlaku_hingga + 3 hari`), cron tidak pernah berjalan (tak terdaftar di `vercel.json`), dan halaman super admin menampilkan status mentah dari DB.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type OrgStatus { status: string, berlaku_hingga: string | null }
  OUTPUT: boolean

  RETURN input.berlaku_hingga IS NOT NULL
         AND today() > input.berlaku_hingga
         AND input.status IN ['trial', 'active']
         // Bug: sistem masih menganggap aktif / menampilkan status lama,
         // belum menjadi 'expired' secara efektif
END FUNCTION
```

### Examples

- Organisasi status `trial`, `berlaku_hingga = 2024-01-01`, hari ini `2024-01-02`. Diharapkan: efektif `expired` dan tidak aktif. Aktual: masih tampil `TRIAL` di `/sa` dan masih dianggap aktif (grace period belum lewat).
- Organisasi status `active`, `berlaku_hingga = kemarin`. Diharapkan: `expired`. Aktual: `isOrgActive` mengembalikan `true` karena baru 1 hari lewat, di bawah grace 3 hari.
- Organisasi status `trial`, `berlaku_hingga` sudah lewat 5 hari sejak sebelum perbaikan, cron tak pernah jalan. Diharapkan: sudah `expired` di DB. Aktual: masih `trial` (record historis tidak diperbaiki).
- Edge — organisasi `berlaku_hingga = hari ini` (`today == berlaku_hingga`). Diharapkan: masih aktif (belum lewat). Bukan bug: `today > berlaku_hingga` bernilai false.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Organisasi yang belum melewati tanggal (`today <= berlaku_hingga`) dengan status `trial`/`active` tetap aktif dan status ditampilkan apa adanya (Req 3.1).
- Organisasi berstatus `suspended` tetap dianggap tidak aktif tanpa memandang tanggal (Req 3.2).
- Organisasi berstatus `expired` tetap dianggap tidak aktif (Req 3.3).
- Organisasi tanpa `berlaku_hingga` (null) tetap diperlakukan seperti sekarang — tidak dianggap expired karena tanggal (Req 3.4).
- Endpoint cron tetap memvalidasi otorisasi via Bearer `CRON_SECRET` dan menolak request tak terotorisasi (Req 3.5).

**Scope:**
Semua input yang TIDAK memenuhi bug condition harus sepenuhnya tidak terpengaruh oleh fix ini. Termasuk:
- Organisasi yang masih dalam masa berlaku (`today <= berlaku_hingga`).
- Organisasi `suspended` atau `expired`.
- Organisasi dengan `berlaku_hingga = null`.

**Catatan:** Perilaku benar yang diharapkan untuk bug condition didefinisikan di bagian Correctness Properties (Property 1). Bagian ini fokus pada apa yang TIDAK boleh berubah.

## Hypothesized Root Cause

Berdasarkan analisis kode, penyebab paling mungkin adalah:

1. **Gerbang grace period pada logika expiry**: `isOrgActive` dan lazy-update di `getAuthContext` memakai `isPastGracePeriod` (`today > berlaku_hingga + 3 hari`), sehingga organisasi yang baru lewat tanggal (tetapi < 3 hari) masih dianggap aktif dan tidak diubah menjadi `expired`. Ini bertentangan dengan keputusan pengguna (expiry langsung, tanpa grace).

2. **Cron tidak terjadwal**: `apps/web/src/app/api/cron/update-expired-orgs/route.ts` sudah benar (`.lt('berlaku_hingga', today).in('status', ['trial','active'])`), namun tidak terdaftar di `apps/web/vercel.json` sehingga tidak pernah dieksekusi. Akibatnya record basi tidak pernah diperbaiki otomatis.

3. **Super admin menampilkan status mentah**: `apps/web/src/app/(super-admin)/sa/page.tsx` membaca `status` langsung dari DB tanpa menghitung status efektif atau merekonsiliasi record basi, sehingga organisasi yang seharusnya `expired` tetap tampil `TRIAL`/`ACTIVE`.

4. **Metode invokasi cron (potensi mismatch)**: Vercel Cron memanggil endpoint dengan **GET** dan menyertakan header `Authorization: Bearer <CRON_SECRET>` secara otomatis, sedangkan kedua route cron (`update-expired-orgs` dan `send-expiry-emails`) saat ini hanya mengekspor handler **POST**. Jika benar, cron akan mendapat 405 dan tidak pernah berhasil. Ini perlu dikonfirmasi/diselaraskan (lihat Fix Implementation poin 4).

## Correctness Properties

Property 1: Bug Condition - Expiry langsung tanpa grace period

_For any_ organisasi di mana bug condition berlaku (`isBugCondition` mengembalikan true — yakni `berlaku_hingga` tidak null, `today > berlaku_hingga`, dan status `trial`/`active`), sistem SHALL memperlakukan organisasi sebagai tidak aktif (`isOrgActive` mengembalikan false) dan status efektifnya SHALL bernilai `expired` di semua jalur (lazy-update login, cron, dan tampilan super admin), tanpa toleransi grace period.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Input non-bug tidak berubah

_For any_ input di mana bug condition TIDAK berlaku (`isBugCondition` mengembalikan false — yakni belum lewat tanggal, `suspended`, `expired`, atau `berlaku_hingga = null`), fungsi setelah fix SHALL menghasilkan keputusan aktif/tidak aktif dan status yang sama persis seperti sebelum fix, mempertahankan perilaku untuk organisasi berlaku, suspended, expired, dan tanpa tanggal, serta tetap menolak request cron tak terotorisasi.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Dengan asumsi analisis akar masalah benar:

**File**: `apps/web/src/lib/org-status.ts`

**Function**: `isExpiredByDate` (baru), `isOrgActive`, dan fungsi grace period

**Specific Changes**:
1. **Tambah fungsi expiry tunggal**: Buat `isExpiredByDate(berlaku_hingga)` yang mengembalikan `!!berlaku_hingga && today() > berlaku_hingga`. Ini menjadi satu-satunya definisi kondisi expiry.
2. **Ubah `isOrgActive`**: Ganti gerbang `!isPastGracePeriod(...)` menjadi `!isExpiredByDate(org.berlaku_hingga)`. Status `suspended`/`expired` tetap dikembalikan false seperti sebelumnya.
3. **Netralkan grace period**: Karena expiry menjadi langsung, `isInGracePeriod` selalu false dan `gracePeriodDaysLeft` selalu 0 (atau hapus/deprecate). Ini membuat cabang "grace period" pada `TrialInfoCard` menjadi dead code — pertahankan cabang `expired`/`suspended` dan `trial`/`active` agar UI tetap benar. Pertimbangkan menghapus `GRACE_PERIOD_DAYS`/`isPastGracePeriod` bila tidak lagi dipakai di manapun.

**File**: `apps/web/src/lib/auth.ts`

**Function**: `getAuthContext`

4. **Lazy-update pakai kondisi baru**: Ganti `isPastGracePeriod(org.berlaku_hingga)` pada blok lazy-update menjadi `isExpiredByDate(org.berlaku_hingga)`, sehingga organisasi yang lewat tanggal langsung diubah menjadi `expired` saat login.

**File**: `apps/web/vercel.json`

5. **Daftarkan cron harian**: Tambahkan entri crons untuk `/api/cron/update-expired-orgs` dengan jadwal harian (mis. `0 1 * * *`), berdampingan dengan `send-expiry-emails`.

**File**: `apps/web/src/app/api/cron/update-expired-orgs/route.ts` (dan selaraskan `send-expiry-emails/route.ts` bila perlu)

6. **Selaraskan metode invokasi cron**: Konfirmasi apakah Vercel Cron memanggil via GET. Bila ya, ekspor handler `GET` (atau alias GET→logika yang sama) yang tetap memvalidasi `Authorization: Bearer <CRON_SECRET>`. Pertahankan penolakan 401 untuk request tak terotorisasi (Req 3.5). Terapkan pola yang sama untuk kedua route agar konsisten.

**File**: `apps/web/src/app/(super-admin)/sa/page.tsx`

7. **Rekonsiliasi status basi saat load (direkomendasikan)**: Sebelum render, jalankan update via admin client yang menandai `expired` semua organisasi dengan `status IN ('trial','active') AND berlaku_hingga < today` (logika yang sama dengan cron), lalu fetch daftar organisasi. Pendekatan ini menjaga DB tetap konsisten dan sekaligus memperbaiki record historis (Req 2.4) tanpa perlu backfill terpisah. Alternatif ringan: hanya menghitung status efektif untuk tampilan — tidak direkomendasikan karena DB tetap basi.

### Catatan Backfill

Record historis yang sudah terlanjur lewat tanggal (Req 2.4) akan otomatis terperbaiki oleh: (a) rekonsiliasi saat halaman super admin dimuat, (b) cron harian setelah terdaftar, dan (c) lazy-update saat masing-masing organisasi login. Tidak diperlukan skrip backfill khusus.

## Testing Strategy

### Validation Approach

Strategi pengujian dua fase: pertama munculkan counterexample yang membuktikan bug pada kode belum-diperbaiki, lalu verifikasi fix bekerja benar dan mempertahankan perilaku non-bug.

### Exploratory Bug Condition Checking

**Goal**: Memunculkan counterexample yang mendemonstrasikan bug SEBELUM fix diterapkan, untuk mengonfirmasi atau membantah analisis akar masalah. Bila terbantahkan, hipotesis akar masalah perlu disusun ulang.

**Test Plan**: Tulis tes yang memanggil `isOrgActive` dan mensimulasikan lazy-update `getAuthContext` untuk organisasi yang baru saja lewat tanggal (1 hari), lalu memeriksa tampilan/rekonsiliasi super admin. Jalankan pada kode UNFIXED untuk mengamati kegagalan.

**Test Cases**:
1. **Trial baru lewat 1 hari**: `isOrgActive({status:'trial', berlaku_hingga: kemarin})` diharapkan false — akan gagal pada kode unfixed (mengembalikan true karena grace period).
2. **Active baru lewat 1 hari**: sama seperti di atas untuk status `active` (will fail on unfixed code).
3. **Super admin menampilkan status basi**: organisasi lewat tanggal tetap tampil `TRIAL`/`ACTIVE` di `/sa` (will fail on unfixed code).
4. **Edge - tepat di tanggal**: `berlaku_hingga = hari ini` diharapkan tetap aktif (may fail if boundary salah ditangani).

**Expected Counterexamples**:
- `isOrgActive` mengembalikan `true` untuk organisasi yang lewat tanggal < 3 hari.
- Kemungkinan penyebab: gerbang grace period pada `isOrgActive`/`getAuthContext`, cron tak terjadwal, super admin baca status mentah.

### Fix Checking

**Goal**: Memverifikasi bahwa untuk semua input yang memenuhi bug condition, fungsi setelah fix menghasilkan perilaku yang diharapkan.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  ASSERT isOrgActive_fixed(input) == false
  ASSERT effectiveStatus_fixed(input) == 'expired'
END FOR
```

### Preservation Checking

**Goal**: Memverifikasi bahwa untuk semua input yang TIDAK memenuhi bug condition, fungsi setelah fix menghasilkan hasil yang sama dengan sebelum fix.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT isOrgActive_original(input) == isOrgActive_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing direkomendasikan untuk preservation checking karena:
- Menghasilkan banyak kasus uji otomatis di seluruh domain input (status, berbagai tanggal relatif, null).
- Menangkap edge case yang mungkin terlewat oleh unit test manual.
- Memberi jaminan kuat bahwa perilaku tidak berubah untuk seluruh input non-bug.

**Test Plan**: Amati perilaku pada kode UNFIXED untuk input non-bug (belum lewat tanggal, suspended, expired, null), lalu tulis property-based test yang menangkap perilaku tersebut dan pastikan tetap sama setelah fix.

**Test Cases**:
1. **Belum lewat tanggal**: organisasi `trial`/`active` dengan `today <= berlaku_hingga` tetap aktif (Req 3.1).
2. **Suspended**: tetap tidak aktif tanpa memandang tanggal (Req 3.2).
3. **Expired**: tetap tidak aktif (Req 3.3).
4. **Tanpa `berlaku_hingga`**: tetap diperlakukan seperti sekarang (Req 3.4).
5. **Cron tak terotorisasi**: request tanpa/dengan Bearer salah tetap ditolak 401 (Req 3.5).

### Unit Tests

- `isExpiredByDate` untuk tanggal lewat, tepat di tanggal, belum lewat, dan null.
- `isOrgActive` untuk kombinasi status (`trial`, `active`, `suspended`, `expired`) × tanggal (lewat, tepat, belum, null).
- Lazy-update `getAuthContext` mengubah `trial`/`active` yang lewat tanggal menjadi `expired`, dan tidak mengubah input non-bug.

### Property-Based Tests

- Generate status dan `berlaku_hingga` acak; verifikasi Property 1 (bug condition → tidak aktif & `expired`).
- Generate input non-bug acak; verifikasi Property 2 (hasil `isOrgActive` identik sebelum vs sesudah fix).
- Generate variasi tanggal di sekitar boundary (`today-1`, `today`, `today+1`) untuk memastikan penanganan batas benar.

### Integration Tests

- Alur super admin `/sa`: organisasi lewat tanggal direkonsiliasi menjadi `expired` dan `StatusBadge` menampilkan `EXPIRED`.
- Endpoint cron `update-expired-orgs`: dengan otorisasi valid menandai organisasi lewat tanggal menjadi `expired`; tanpa otorisasi menolak 401; metode invokasi (GET/POST) sesuai konfigurasi Vercel.
- Alur login organisasi lewat tanggal: `TrialInfoCard` menampilkan tampilan expired/suspended, bukan cabang grace period.
