# Implementation Plan

> Catatan proyek: belum ada test framework yang terpasang. Sesuai konvensi spec sebelumnya di proyek ini, "tes" eksplorasi/preservation dijalankan sebagai verifikasi manual ringan (script sementara / pemanggilan fungsi langsung) plus `pnpm --filter web exec tsc --noEmit` untuk validasi tipe. Hapus script sementara setelah selesai.

- [ ] 1. Tulis tes eksplorasi bug condition (SEBELUM menerapkan fix)
  - **Property 1: Bug Condition** - Expiry Langsung Tanpa Grace Period
  - **CRITICAL**: Tes ini HARUS GAGAL pada kode belum-diperbaiki — kegagalan mengonfirmasi bug memang ada
  - **DO NOT attempt to fix the test or the code when it fails** pada fase ini
  - **NOTE**: Tes ini meng-encode expected behavior — akan memvalidasi fix ketika PASS setelah implementasi
  - **GOAL**: Memunculkan counterexample yang mendemonstrasikan bug
  - **Scoped PBT Approach**: Bug bersifat deterministik terhadap tanggal — batasi properti ke kasus konkret yang gagal: `berlaku_hingga = kemarin` dengan status `trial` dan `active`
  - Panggil `isOrgActive({ status: 'trial', berlaku_hingga: <kemarin> })` dan `isOrgActive({ status: 'active', berlaku_hingga: <kemarin> })` — sesuai `isBugCondition(input)` di design (`berlaku_hingga != null AND today() > berlaku_hingga AND status IN ['trial','active']`)
  - Assertion sesuai Expected Behavior / Property 1 di design: hasil SHALL `false` (tidak aktif) dan status efektif SHALL `expired`
  - Sertakan kasus edge boundary: `berlaku_hingga = hari ini` diharapkan tetap aktif (bukan bug, `today > berlaku_hingga` = false)
  - Jalankan pada kode UNFIXED
  - **EXPECTED OUTCOME**: Tes GAGAL (benar — membuktikan bug: `isOrgActive` mengembalikan `true` karena masih dalam grace period 3 hari)
  - Dokumentasikan counterexample yang ditemukan (mis. "isOrgActive({status:'trial', berlaku_hingga: kemarin}) === true, seharusnya false")
  - Tandai task selesai saat tes ditulis, dijalankan, dan kegagalan terdokumentasi
  - _Requirements: 2.1, 2.2, 2.5_

- [ ] 2. Tulis tes preservation (SEBELUM menerapkan fix)
  - **Property 2: Preservation** - Input Non-Bug Tidak Berubah
  - **IMPORTANT**: Ikuti metodologi observation-first
  - Amati perilaku pada kode UNFIXED untuk input non-bug lalu catat outputnya:
    - `isOrgActive({ status: 'trial', berlaku_hingga: <besok> })` → amati (diharapkan `true`, belum lewat) (Req 3.1)
    - `isOrgActive({ status: 'active', berlaku_hingga: <hari ini> })` → amati (boundary, tetap aktif) (Req 3.1)
    - `isOrgActive({ status: 'suspended', berlaku_hingga: <apapun> })` → amati (`false`) (Req 3.2)
    - `isOrgActive({ status: 'expired', berlaku_hingga: <apapun> })` → amati (`false`) (Req 3.3)
    - `isOrgActive({ status: 'trial', berlaku_hingga: null })` → amati (Req 3.4)
    - Request cron tanpa header / dengan Bearer salah → amati respons `401` (Req 3.5)
  - Tulis property-based test yang menangkap pola perilaku teramati di seluruh domain input non-bug (status × tanggal relatif belum-lewat/null): hasil `isOrgActive` setelah fix SHALL identik dengan sebelum fix (dari Preservation Requirements di design)
  - Property-based testing menghasilkan banyak kasus untuk jaminan lebih kuat bahwa perilaku non-bug tidak berubah
  - Jalankan tes pada kode UNFIXED
  - **EXPECTED OUTCOME**: Tes PASS (mengonfirmasi baseline behavior yang harus dipertahankan)
  - Tandai task selesai saat tes ditulis, dijalankan, dan PASS pada kode unfixed
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix untuk auto-expire organisasi (expiry langsung, konsisten di semua jalur)

  - [ ] 3.1 Tambah `isExpiredByDate` dan ubah `isOrgActive` di `org-status.ts`
    - Tambah fungsi tunggal `isExpiredByDate(berlaku_hingga)` = `!!berlaku_hingga && today() > berlaku_hingga` di `apps/web/src/lib/org-status.ts`
    - Ubah `isOrgActive`: ganti gerbang `!isPastGracePeriod(...)` menjadi `!isExpiredByDate(org.berlaku_hingga)`; pertahankan `suspended`/`expired` tetap `false`
    - Netralkan grace period: `isInGracePeriod` selalu `false`, `gracePeriodDaysLeft` selalu `0`; deprecate/hapus `GRACE_PERIOD_DAYS`/`isPastGracePeriod` bila tak lagi dipakai. Pertahankan cabang `expired`/`suspended` dan `trial`/`active` pada `TrialInfoCard`
    - _Bug_Condition: isBugCondition(input) where berlaku_hingga != null AND today() > berlaku_hingga AND status IN ['trial','active']_
    - _Expected_Behavior: expectedBehavior(result) — isOrgActive === false dan status efektif 'expired' (Property 1 di design)_
    - _Preservation: Preservation Requirements di design (belum lewat / suspended / expired / null tidak berubah)_
    - _Requirements: 2.2, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [ ] 3.2 Selaraskan lazy-update login di `auth.ts`
    - Di `getAuthContext` (`apps/web/src/lib/auth.ts`), ganti `isPastGracePeriod(org.berlaku_hingga)` pada blok lazy-update menjadi `isExpiredByDate(org.berlaku_hingga)` agar organisasi lewat tanggal langsung diubah menjadi `expired` saat login
    - _Bug_Condition: isBugCondition(input) from design_
    - _Expected_Behavior: expectedBehavior(result) — status di-update ke 'expired' saat login (Property 1)_
    - _Preservation: input non-bug tidak diubah statusnya_
    - _Requirements: 2.2, 2.5_

  - [ ] 3.3 Daftarkan cron harian di `vercel.json`
    - Tambahkan entri `crons` untuk `/api/cron/update-expired-orgs` dengan jadwal harian (mis. `0 1 * * *`), berdampingan dengan `send-expiry-emails`
    - _Bug_Condition: organisasi lewat tanggal tidak pernah di-expire otomatis karena cron tak terdaftar_
    - _Expected_Behavior: cron terjadwal menandai organisasi lewat tanggal menjadi 'expired' (Property 1)_
    - _Preservation: tidak memengaruhi endpoint/route lain_
    - _Requirements: 2.3_

  - [ ] 3.4 Selaraskan metode invokasi cron (GET + Bearer CRON_SECRET)
    - Tambahkan handler `GET` pada `apps/web/src/app/api/cron/update-expired-orgs/route.ts` dan `send-expiry-emails/route.ts` (Vercel Cron memanggil via GET dengan header `Authorization: Bearer <CRON_SECRET>`)
    - Pertahankan validasi otorisasi dan penolakan `401` untuk request tak terotorisasi; gunakan pola yang sama di kedua route
    - _Bug_Condition: cron gagal (405) karena hanya ada handler POST sehingga expiry tak pernah jalan_
    - _Expected_Behavior: cron GET terotorisasi berhasil menjalankan expiry (Property 1)_
    - _Preservation: request tanpa/dengan Bearer salah tetap ditolak 401 (Req 3.5)_
    - _Requirements: 2.3, 3.5_

  - [ ] 3.5 Rekonsiliasi status basi saat memuat halaman super admin
    - Di `apps/web/src/app/(super-admin)/sa/page.tsx`, sebelum render jalankan update via admin client yang menandai `expired` semua organisasi dengan `status IN ('trial','active') AND berlaku_hingga < today` (logika sama dengan cron), lalu fetch daftar organisasi
    - Ini menjaga DB konsisten dan memperbaiki record historis tanpa backfill terpisah
    - _Bug_Condition: /sa menampilkan status mentah dari DB sehingga organisasi lewat tanggal tetap tampil TRIAL/ACTIVE_
    - _Expected_Behavior: status efektif ditampilkan/dihitung sebagai 'expired'; record basi diperbaiki (Property 1, Req 2.4)_
    - _Preservation: organisasi belum lewat / suspended / expired / null tetap tampil apa adanya_
    - _Requirements: 2.1, 2.4_

  - [ ] 3.6 Verifikasi tes eksplorasi bug condition kini PASS
    - **Property 1: Expected Behavior** - Expiry Langsung Tanpa Grace Period
    - **IMPORTANT**: Jalankan ulang tes YANG SAMA dari task 1 — JANGAN menulis tes baru
    - Tes dari task 1 meng-encode expected behavior; ketika PASS berarti expected behavior terpenuhi
    - Jalankan tes eksplorasi dari step 1
    - **EXPECTED OUTCOME**: Tes PASS (mengonfirmasi bug telah diperbaiki: `isOrgActive` false & status efektif `expired`)
    - _Requirements: 2.1, 2.2, 2.5 (Expected Behavior Properties di design)_

  - [ ] 3.7 Verifikasi tes preservation masih PASS
    - **Property 2: Preservation** - Input Non-Bug Tidak Berubah
    - **IMPORTANT**: Jalankan ulang tes YANG SAMA dari task 2 — JANGAN menulis tes baru
    - Jalankan tes preservation dari step 2
    - **EXPECTED OUTCOME**: Tes PASS (mengonfirmasi tidak ada regresi)
    - Pastikan semua tes tetap lolos setelah fix (input belum-lewat/suspended/expired/null tidak berubah; cron tetap tolak 401)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4. Checkpoint - Pastikan semua tes lolos dan tipe valid
  - Jalankan seluruh tes eksplorasi & preservation; pastikan semua PASS
  - Jalankan `pnpm --filter web exec tsc --noEmit` untuk memastikan tidak ada error tipe
  - Hapus script/tes sementara yang dibuat untuk verifikasi manual
  - Bila ada pertanyaan atau hasil tak terduga, tanyakan ke user
