# Bugfix Requirements Document

## Introduction

Pada device tertentu, ketika pengguna menekan tombol **Masuk** di halaman `/login` atau tombol **Daftar Sekarang** di halaman `/register`, aplikasi menampilkan pesan error mentah `Failed to fetch` pada UI (di dalam alert box merah pada form). Bug ini bersifat *device-specific* — tidak semua device mengalaminya. Pesan `Failed to fetch` adalah error generik dari browser Fetch API yang muncul ketika permintaan HTTP gagal sebelum sempat menerima response (misalnya karena DNS gagal, koneksi diblokir extension/ad-blocker, proxy/VPN memutus koneksi, service worker mengintersep dengan tidak benar, browser lama tidak mendukung fetch options tertentu, atau endpoint Supabase tidak reachable dari device tersebut).

Bug ini bukan regresi dari perbaikan terbaru — sudah ada sebelumnya. Dampaknya pengguna terjebak: mereka tidak bisa login atau mendaftar dari device yang bermasalah, dan pesan error yang muncul tidak memberi petunjuk apa yang harus dilakukan.

Ruang lingkup bugfix ini adalah alur autentikasi client-side di `apps/web/src/app/(auth)/login/page.tsx` dan `apps/web/src/app/(auth)/register/page.tsx`, yang memanggil Supabase auth melalui `createClient()` dari `@/lib/supabase/client`, dan pada halaman register juga memanggil endpoint internal `/api/org/create` via `fetch`.

## Bug Analysis

### Current Behavior (Defect)

Saat panggilan jaringan ke Supabase auth atau ke `/api/org/create` gagal di level transport (fetch reject) pada device tertentu, aplikasi menampilkan pesan mentah `Failed to fetch` dan meninggalkan pengguna tanpa panduan.

1.1 WHEN pengguna menekan tombol Masuk di `/login` dan panggilan `supabase.auth.signInWithPassword` gagal karena network error (fetch reject) THEN the system menampilkan pesan alert mentah `Failed to fetch` di form dan tombol kembali aktif tanpa panduan lanjutan
1.2 WHEN pengguna menekan tombol Daftar Sekarang di `/register` dan panggilan `supabase.auth.signUp` gagal karena network error (fetch reject) THEN the system menampilkan pesan alert mentah `Failed to fetch` di form tanpa menjelaskan penyebab atau langkah pemulihan
1.3 WHEN pengguna menekan tombol Daftar Sekarang di `/register`, `supabase.auth.signUp` berhasil, tetapi panggilan `fetch('/api/org/create')` gagal di level transport THEN the system menampilkan pesan mentah `Failed to fetch` sementara akun Supabase sudah terbuat, meninggalkan state tidak konsisten tanpa panduan retry
1.4 WHEN network error terjadi pada device yang bermasalah (mis. koneksi ke Supabase diblokir extension, service worker basi, atau endpoint tidak reachable) THEN the system tidak memberikan diagnosa atau instruksi pemulihan kepada pengguna
1.5 WHEN error `Failed to fetch` terjadi THEN the system tidak mencatat konteks apapun (URL yang gagal, jenis operasi) yang bisa membantu diagnosa device-specific

### Expected Behavior (Correct)

Ketika panggilan jaringan gagal di level transport pada halaman login/register, aplikasi menampilkan pesan berbahasa Indonesia yang ramah, memberi panduan pemulihan, dan menjaga konsistensi state.

2.1 WHEN pengguna menekan tombol Masuk di `/login` dan panggilan `supabase.auth.signInWithPassword` gagal karena network error THEN the system SHALL menampilkan pesan berbahasa Indonesia yang menjelaskan bahwa terjadi gangguan koneksi (bukan teks mentah `Failed to fetch`) dan menyarankan langkah pemulihan (cek koneksi, matikan ad-blocker/VPN, refresh, atau coba device lain)
2.2 WHEN pengguna menekan tombol Daftar Sekarang di `/register` dan panggilan `supabase.auth.signUp` gagal karena network error THEN the system SHALL menampilkan pesan berbahasa Indonesia yang ramah beserta saran pemulihan yang sama, dan mempertahankan input form sehingga pengguna dapat mencoba lagi tanpa mengetik ulang
2.3 WHEN pengguna menekan tombol Daftar Sekarang, `supabase.auth.signUp` berhasil, tetapi `fetch('/api/org/create')` gagal di level transport THEN the system SHALL menampilkan pesan yang menjelaskan bahwa akun sudah dibuat namun pembuatan organisasi gagal karena gangguan jaringan, dan menyarankan pengguna mencoba lagi atau login kembali
2.4 WHEN error jaringan level transport terdeteksi (fetch reject / `TypeError: Failed to fetch` / `Network request failed`) THEN the system SHALL memetakannya ke pesan ramah bahasa Indonesia sebelum ditampilkan pada UI
2.5 WHEN error jaringan level transport terjadi pada halaman login atau register THEN the system SHALL mencatat konteks minimal ke `console.error` (jenis operasi dan pesan error asli) untuk memudahkan diagnosa device-specific tanpa mengekspos data sensitif pada UI
2.6 WHEN pesan error ditampilkan setelah kegagalan network THEN the system SHALL memastikan tombol submit kembali aktif (loading state di-reset) sehingga pengguna dapat mencoba lagi

### Unchanged Behavior (Regression Prevention)

Perilaku normal untuk kredensial valid, kredensial invalid, dan validasi form harus tetap sama persis seperti sebelumnya.

3.1 WHEN pengguna memasukkan kredensial valid di `/login` dan panggilan Supabase berhasil THEN the system SHALL CONTINUE TO melakukan `router.push(redirectTo)` dan `router.refresh()` seperti sebelumnya
3.2 WHEN pengguna memasukkan kredensial invalid di `/login` dan Supabase mengembalikan `Invalid login credentials` THEN the system SHALL CONTINUE TO menampilkan pesan `Email atau password salah.` seperti sebelumnya
3.3 WHEN Supabase mengembalikan `authError` non-network lainnya di `/login` THEN the system SHALL CONTINUE TO menampilkan `authError.message` apa adanya seperti sebelumnya
3.4 WHEN pengguna mengisi form register dengan password tidak cocok, kurang dari 6 karakter, atau nama organisasi kosong THEN the system SHALL CONTINUE TO menampilkan pesan validasi client-side yang sudah ada tanpa memanggil jaringan
3.5 WHEN pengguna mendaftar dengan input valid dan seluruh panggilan (`signUp` dan `/api/org/create`) berhasil THEN the system SHALL CONTINUE TO mengarahkan ke `/app` dan memanggil `router.refresh()` seperti sebelumnya
3.6 WHEN `supabase.auth.signUp` mengembalikan `authError` non-network THEN the system SHALL CONTINUE TO menampilkan `authError.message` seperti sebelumnya
3.7 WHEN `/api/org/create` mengembalikan response non-OK dengan body JSON berisi `error` THEN the system SHALL CONTINUE TO menampilkan pesan tersebut seperti sebelumnya
3.8 WHEN pengguna menavigasi antar `/login`, `/register`, dan halaman lain THEN the system SHALL CONTINUE TO memuat halaman seperti sebelumnya tanpa perubahan layout, styling, atau routing
