# Bugfix Requirements Document

## Introduction

Akun `dedehermansyah452@gmail.com` mengalami halaman dashboard kosong (blank) setelah login, sementara akun lain berfungsi normal. Bug ini bersifat account-specific dan kemungkinan besar disebabkan oleh data user yang tidak lengkap atau tidak valid di database (misalnya: tidak ada record membership, memiliki lebih dari satu membership, atau data organisasi yang rusak/null).

Alur kode saat ini:
1. `getAuthContext()` mengambil user dari Supabase auth, lalu query `memberships` dengan `.single()`
2. Jika user tidak punya membership atau punya lebih dari satu membership, `.single()` gagal dan `getAuthContext()` return `null`
3. Layout admin memeriksa `if (!ctx) redirect('/login')` — tapi user sudah terautentikasi, sehingga login kembali mengarah balik ke `/app`, menciptakan redirect loop yang menghasilkan halaman blank
4. Alternatif lain: membership ada tapi data organisasi rusak (null/invalid), menyebabkan error saat render

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN user yang terautentikasi tidak memiliki record di tabel `memberships` (atau query `.single()` gagal karena duplikat membership) THEN sistem melakukan redirect loop antara `/app` dan `/login` sehingga dashboard tampil blank/kosong

1.2 WHEN `getAuthContext()` return `null` untuk user yang sudah terautentikasi THEN sistem tidak menampilkan pesan error yang informatif, melainkan hanya redirect ke `/login` yang menyebabkan loop

1.3 WHEN user memiliki membership tapi data organisasi terkait tidak lengkap atau null THEN sistem berpotensi crash/error saat mengakses properti organisasi (nama, status, berlaku_hingga) yang mengakibatkan halaman blank

### Expected Behavior (Correct)

2.1 WHEN user yang terautentikasi tidak memiliki record di tabel `memberships` THEN sistem SHALL menampilkan halaman informatif yang menjelaskan bahwa akun belum terhubung ke organisasi manapun, tanpa redirect loop

2.2 WHEN `getAuthContext()` gagal mengambil data membership untuk user yang terautentikasi THEN sistem SHALL menampilkan pesan error yang jelas (misalnya "Akun Anda belum terdaftar di organisasi manapun. Hubungi admin.") dan tetap menampilkan halaman yang valid

2.3 WHEN user memiliki membership tapi data organisasi terkait tidak lengkap atau null THEN sistem SHALL menangani data yang tidak lengkap dengan graceful (fallback/default values) dan menampilkan pesan yang sesuai tanpa crash

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user yang terautentikasi memiliki satu membership dengan data organisasi yang lengkap dan valid THEN sistem SHALL CONTINUE TO menampilkan dashboard dengan benar termasuk sidebar, welcome message, dan feature cards

3.2 WHEN user yang tidak terautentikasi (belum login) mengakses `/app` THEN sistem SHALL CONTINUE TO redirect ke halaman `/login`

3.3 WHEN user memiliki organisasi dengan status `active` atau `trial` yang belum expired THEN sistem SHALL CONTINUE TO menampilkan dashboard lengkap dengan semua fitur

3.4 WHEN user memiliki organisasi dengan status `expired` atau `suspended` THEN sistem SHALL CONTINUE TO menampilkan TrialInfoCard tanpa akses ke dashboard features
