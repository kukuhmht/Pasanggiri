# Bugfix Requirements Document

## Introduction

Organisasi/akun yang sudah melewati tanggal `berlaku_hingga` masih tampil dengan status "trial" (atau "active") di menu super admin (`/sa`) dan masih dianggap aktif oleh aplikasi. Penyebabnya ada beberapa: cron auto-expire tidak terdaftar di `vercel.json` sehingga tidak pernah berjalan, halaman super admin membaca status mentah dari database tanpa menghitung status efektif, dan terdapat inkonsistensi grace period 3 hari antara lazy-update saat login dan cron.

Keputusan pengguna: akun harus **langsung** menjadi Expired begitu melewati tanggal Berlaku, **tanpa grace period**. Grace period 3 hari dihapus agar seluruh jalur (login, cron, tampilan super admin) konsisten. Trigger expiry = `today > berlaku_hingga`.

## Bug Analysis

### Current Behavior (Defect)

Perilaku yang saat ini terjadi ketika akun sudah melewati tanggal berlaku:

1.1 WHEN tanggal hari ini sudah melewati `berlaku_hingga` sebuah organisasi yang berstatus "trial" atau "active" THEN sistem tetap menampilkan status "trial"/"active" di menu super admin (`/sa`) karena status dibaca mentah dari database tanpa menghitung status efektif

1.2 WHEN tanggal hari ini sudah melewati `berlaku_hingga` namun belum melewati grace period 3 hari THEN sistem masih menganggap organisasi aktif (`isOrgActive` mengembalikan true) dan lazy-update saat login belum mengubah status menjadi "expired"

1.3 WHEN organisasi sudah melewati `berlaku_hingga` THEN sistem tidak pernah mengubah status menjadi "expired" secara otomatis karena cron `/api/cron/update-expired-orgs` tidak terdaftar di `vercel.json` sehingga tidak pernah berjalan

1.4 WHEN sebuah organisasi sudah terlanjur melewati `berlaku_hingga` sejak sebelum perbaikan THEN sistem membiarkan record tersebut tetap berstatus "trial"/"active" (data historis tidak diperbaiki)

### Expected Behavior (Correct)

Perilaku yang seharusnya terjadi:

2.1 WHEN tanggal hari ini sudah melewati `berlaku_hingga` sebuah organisasi yang berstatus "trial" atau "active" THEN sistem SHALL menampilkan/menghitung status organisasi sebagai "expired" di menu super admin (`/sa`)

2.2 WHEN tanggal hari ini sudah melewati `berlaku_hingga` THEN sistem SHALL menganggap organisasi tidak aktif segera (tanpa grace period), yaitu `isOrgActive` mengembalikan false dan lazy-update saat login mengubah status menjadi "expired"

2.3 WHEN organisasi melewati `berlaku_hingga` THEN sistem SHALL menandai status menjadi "expired" secara otomatis melalui cron yang terjadwal dan terdaftar di `vercel.json`

2.4 WHEN terdapat organisasi yang sudah terlanjur melewati `berlaku_hingga` namun masih berstatus "trial"/"active" THEN sistem SHALL memperbaiki record tersebut menjadi "expired"

2.5 WHEN mengevaluasi apakah sebuah organisasi expired THEN sistem SHALL menggunakan kondisi tunggal yang konsisten `today > berlaku_hingga` di semua jalur (tampilan super admin, lazy-update login, dan cron), tanpa grace period 3 hari

### Unchanged Behavior (Regression Prevention)

Perilaku yang harus tetap dipertahankan:

3.1 WHEN tanggal hari ini belum melewati `berlaku_hingga` (today <= berlaku_hingga) THEN sistem SHALL CONTINUE TO menganggap organisasi "trial"/"active" tetap aktif dan menampilkan statusnya sebagaimana adanya

3.2 WHEN organisasi berstatus "suspended" THEN sistem SHALL CONTINUE TO menganggap organisasi tidak aktif tanpa memandang tanggal berlaku

3.3 WHEN organisasi berstatus "expired" THEN sistem SHALL CONTINUE TO menganggap organisasi tidak aktif

3.4 WHEN organisasi tidak memiliki `berlaku_hingga` (null) THEN sistem SHALL CONTINUE TO memperlakukannya seperti perilaku saat ini (tidak dianggap expired karena tanggal)

3.5 WHEN request cron auto-expire diterima THEN sistem SHALL CONTINUE TO memvalidasi otorisasi melalui Bearer `CRON_SECRET` dan menolak request yang tidak terotorisasi
