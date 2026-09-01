# Implementation Plan

- [ ] 1. Manual exploration - reproduce bug and document counterexamples
  - **Property 1: Bug Condition** - Transport failure menampilkan pesan mentah `Failed to fetch`
  - **CRITICAL**: Lakukan verifikasi manual ini SEBELUM implementasi fix - kegagalan yang terobservasi mengonfirmasi bug memang ada
  - **DO NOT attempt to fix the code yet** saat mengobservasi kegagalan
  - **NOTE**: Karena project belum memiliki test framework, gunakan verifikasi manual di browser sebagai pengganti test otomatis
  - **GOAL**: Munculkan counterexample yang mendemonstrasikan bug pada kode UNFIXED
  - **Scoped Reproduction Approach**: Simulasikan transport failure dengan salah satu cara:
    - DevTools > Network tab > set throttling ke "Offline", lalu submit form
    - Atau block domain Supabase di hosts file / gunakan ad-blocker rule sementara
    - Atau override `window.fetch` di console: `window.fetch = () => Promise.reject(new TypeError('Failed to fetch'))`
  - Reproduksi skenario berikut pada kode belum-fixed:
    1. Buka `/login`, submit dengan email/password dummy saat network diblokir → observe alert
    2. Buka `/register`, isi form valid, submit saat network diblokir → observe alert + status tombol
    3. Buka `/register`, isi form valid, biarkan `signUp` berhasil (unblock), lalu blok hanya `/api/org/create` (misal via DevTools > Network > Block request URL) → observe alert
  - **EXPECTED OUTCOME**: Semua skenario menampilkan pesan mentah `Failed to fetch` (atau bahkan unhandled rejection di register); ini KONFIRMASI bug
  - Dokumentasikan counterexample yang ditemukan di catatan kerja (screenshot atau catatan singkat):
    - "login submit → alert menampilkan 'Failed to fetch' mentah"
    - "register submit → alert 'Failed to fetch' dan/atau tombol stuck disabled"
    - "register partial-success → tidak ada pesan khusus untuk state terbelah"
  - Mark task complete setelah semua skenario direproduksi dan didokumentasikan
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 2. Manual preservation baseline - observe non-bug behavior on unfixed code
  - **Property 2: Preservation** - Perilaku non-network path tidak boleh berubah
  - **IMPORTANT**: Ikuti observation-first methodology - amati perilaku UNFIXED untuk skenario non-network agar dapat dibandingkan setelah fix
  - **NOTE**: Karena project belum memiliki test framework, gunakan verifikasi manual sebagai baseline
  - Observasi perilaku berikut pada kode belum-fixed dan catat hasilnya (screenshot / catatan):
    1. Login dengan kredensial valid → catat: `router.push(redirectTo)` + `router.refresh()` terjadi, navigasi berhasil ke `/app`
    2. Login dengan kredensial invalid → catat: alert menampilkan `Email atau password salah.`
    3. Register dengan password mismatch → catat: pesan validasi client-side muncul, tidak ada network call
    4. Register dengan password < 6 karakter → catat: pesan validasi client-side muncul
    5. Register dengan nama organisasi kosong → catat: pesan validasi client-side muncul
    6. Register happy path lengkap (input valid, network normal) → catat: navigasi ke `/app` + refresh
    7. Register di mana `/api/org/create` mengembalikan response non-OK terstruktur (mock via DevTools override response ke 400 dengan body `{"error":"nama sudah dipakai"}`) → catat: alert menampilkan pesan `error` dari body
  - **EXPECTED OUTCOME**: Semua skenario di atas menghasilkan perilaku yang tercatat di atas - ini menjadi BASELINE yang harus dipreserve setelah fix
  - Simpan catatan baseline untuk perbandingan pasca-fix di task 3.3
  - Mark task complete setelah semua skenario diobservasi dan dicatat
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 3. Fix for transport-level network error di login dan register

  - [ ] 3.1 Buat helper terpusat untuk deteksi network error dan pesan pengganti
    - Buat file baru `apps/web/src/lib/errors/network.ts`
    - Export fungsi `isNetworkError(err: unknown): boolean`:
      - Return true bila `err instanceof TypeError` dan `err.message` cocok regex `/failed to fetch|network request failed|networkerror/i`
      - Return true bila `err` object dengan `name === 'AuthRetryableFetchError'`
      - Return true bila `err` object dengan `message` string yang cocok regex di atas (termasuk `AuthError` yang membungkus `TypeError`)
      - Return false untuk semua kasus lain (termasuk `AuthError` bisnis seperti `Invalid login credentials`, `null`, `undefined`, primitives)
    - Export konstanta `NETWORK_ERROR_MESSAGE`: teks bahasa Indonesia ~2-3 kalimat yang menjelaskan gangguan koneksi + panduan (periksa koneksi, nonaktifkan ekstensi/ad-blocker/VPN sementara, refresh halaman, coba device/jaringan lain)
    - Export konstanta `PARTIAL_SIGNUP_MESSAGE`: teks bahasa Indonesia yang menjelaskan akun sudah dibuat namun pembuatan organisasi gagal karena gangguan jaringan, saran coba lagi atau login ulang
    - Export fungsi `logNetworkError(op: string, err: unknown): void`: memanggil `console.error` dengan prefix `[network-error][${op}]` diikuti error
    - _Bug_Condition: isBugCondition(input) - transport failure di panggilan auth/fetch_
    - _Expected_Behavior: mapping ke pesan ramah + logging konteks_
    - _Preservation: Fungsi hanya mendeteksi transport failure; error non-network return false sehingga caller tidak mengubah jalurnya_
    - _Requirements: 2.4, 2.5_

  - [ ] 3.2 Terapkan handling network error di login page
    - Edit `apps/web/src/app/(auth)/login/page.tsx`
    - Import `isNetworkError`, `NETWORK_ERROR_MESSAGE`, `logNetworkError` dari `@/lib/errors/network`
    - Bungkus panggilan `supabase.auth.signInWithPassword` dalam `try/catch` (menangkap `TypeError` yang tidak dibungkus Supabase)
    - Di `catch`: bila `isNetworkError(err)` → panggil `logNetworkError('login.signIn', err)`, `setError(NETWORK_ERROR_MESSAGE)`, `setIsLoading(false)`, return; bila bukan → fallback ke pesan generic `authError.message` atau pesan default aman
    - Pada cabang `authError` non-null yang sudah ada: sebelum menampilkan `authError.message`, cek `isNetworkError(authError)`. Bila true → `logNetworkError('login.signIn', authError)` + `setError(NETWORK_ERROR_MESSAGE)`. Bila false → pertahankan cabang `Invalid login credentials` → `'Email atau password salah.'` dan cabang default `authError.message`
    - Pastikan `setIsLoading(false)` tereksekusi di semua jalur error (via `finally` atau eksplisit di tiap cabang)
    - Jangan reset state input form pada error path
    - _Bug_Condition: isBugCondition di login - signInWithPassword gagal transport atau mengembalikan AuthRetryableFetchError_
    - _Expected_Behavior: expectedBehavior - NETWORK_ERROR_MESSAGE tampil, loading di-reset, konteks di-log_
    - _Preservation: kredensial valid tetap push+refresh, invalid tetap `Email atau password salah.`, authError non-network tetap `authError.message`_
    - _Requirements: 2.1, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3_

  - [ ] 3.3 Terapkan handling network error dan partial-success di register page
    - Edit `apps/web/src/app/(auth)/register/page.tsx`
    - Import `isNetworkError`, `NETWORK_ERROR_MESSAGE`, `PARTIAL_SIGNUP_MESSAGE`, `logNetworkError` dari `@/lib/errors/network`
    - Bungkus seluruh blok jaringan (`signUp` + `fetch('/api/org/create')` + parsing response) dalam `try/catch` untuk menutup unhandled rejection
    - Setelah `signUp`: cek `isNetworkError(authError)` (untuk pembungkusan Supabase). Bila true → `logNetworkError('register.signUp', authError)` + `setError(NETWORK_ERROR_MESSAGE)` + return (dengan `setIsLoading(false)`). Bila `authError` non-network → pertahankan `authError.message`
    - Deklarasikan flag `let signUpSucceeded = false` dan set `true` setelah signUp resolve tanpa error, sebelum memanggil `/api/org/create`
    - Di `catch` luar: bila `isNetworkError(err)` dan `signUpSucceeded` → `logNetworkError('register.orgCreate.partial', err)` + `setError(PARTIAL_SIGNUP_MESSAGE)`; bila `isNetworkError(err)` dan !`signUpSucceeded` → `logNetworkError('register.signUp', err)` + `setError(NETWORK_ERROR_MESSAGE)`; bila bukan network → fallback ke pesan generic error.message
    - Response non-OK terstruktur dari `/api/org/create` (body `{error}`) tetap ditampilkan seperti semula
    - Tambahkan `finally` block yang memanggil `setIsLoading(false)` sehingga tombol Daftar Sekarang kembali aktif
    - Jangan reset state input form pada error path (biarkan React default preserve input)
    - Jangan mengubah validasi client-side existing (password mismatch/pendek, org name kosong)
    - _Bug_Condition: isBugCondition di register - signUp atau /api/org/create gagal transport_
    - _Expected_Behavior: expectedBehavior - NETWORK_ERROR_MESSAGE untuk kegagalan signUp, PARTIAL_SIGNUP_MESSAGE untuk kegagalan orgCreate pasca signUp sukses, loading di-reset, form input dipertahankan_
    - _Preservation: validasi client-side, register sukses penuh, authError non-network, response non-OK terstruktur tetap identik_
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [ ] 3.4 Verifikasi manual bug condition sudah diperbaiki
    - **Property 1: Expected Behavior** - Transport failure kini menampilkan pesan ramah Indonesia
    - **IMPORTANT**: Reproduksi ulang SKENARIO YANG SAMA dari task 1 - jangan buat skenario baru
    - Skenario dari task 1 mengencode expected behavior; ketika lulus, ini mengonfirmasi bug fixed
    - Jalankan ulang dengan network di-block di DevTools atau `window.fetch` di-override:
      1. Login submit saat network diblokir → verifikasi alert menampilkan `NETWORK_ERROR_MESSAGE` (bukan `Failed to fetch`), tombol Masuk kembali aktif, `console.error` mencatat `[network-error][login.signIn]`
      2. Register submit saat network diblokir → verifikasi alert `NETWORK_ERROR_MESSAGE`, tombol Daftar aktif, input form dipertahankan, `console.error` mencatat `[network-error][register.signUp]`
      3. Register partial-success (signUp OK, /api/org/create diblokir) → verifikasi alert `PARTIAL_SIGNUP_MESSAGE`, tombol aktif, `console.error` mencatat `[network-error][register.orgCreate.partial]`
      4. AuthRetryableFetchError (mock via `window.fetch` yang selektif) → verifikasi dipetakan ke `NETWORK_ERROR_MESSAGE`
    - **EXPECTED OUTCOME**: Semua skenario menampilkan pesan ramah Indonesia, tidak ada string `Failed to fetch` yang bocor ke UI, loading state selalu reset
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ] 3.5 Verifikasi manual preservation - non-network behavior tidak berubah
    - **Property 2: Preservation** - Perilaku non-network path identik dengan baseline
    - **IMPORTANT**: Reproduksi ulang SKENARIO YANG SAMA dari task 2 - jangan buat skenario baru
    - Bandingkan hasil dengan catatan baseline dari task 2:
      1. Login kredensial valid → tetap `router.push(redirectTo)` + `router.refresh()`
      2. Login kredensial invalid → tetap alert `Email atau password salah.`
      3. Register password mismatch → tetap pesan validasi client-side, tidak ada network call
      4. Register password < 6 karakter → tetap pesan validasi client-side
      5. Register nama organisasi kosong → tetap pesan validasi client-side
      6. Register happy path → tetap navigasi ke `/app` + refresh
      7. Register `/api/org/create` response non-OK terstruktur → tetap alert menampilkan pesan `error` dari body
    - **EXPECTED OUTCOME**: Semua skenario menghasilkan perilaku IDENTIK dengan baseline task 2 (tidak ada regresi)
    - Konfirmasi juga navigasi antar `/login` dan `/register` normal, tidak ada perubahan layout/styling
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 4. Checkpoint - Ensure semua verifikasi manual lulus
  - Konfirmasi task 3.4 (fix checking) lulus: 4 skenario network error semua menampilkan pesan ramah Indonesia
  - Konfirmasi task 3.5 (preservation) lulus: 7 skenario non-network identik dengan baseline
  - Konfirmasi `console.error` mencatat konteks (`login.signIn`, `register.signUp`, `register.orgCreate.partial`) tanpa mengekspos data sensitif ke UI
  - Konfirmasi tidak ada unhandled promise rejection di console untuk kedua halaman
  - Jalankan `pnpm --filter web build` (atau `pnpm build` di root) untuk memastikan tidak ada type error dan build lulus
  - Bila ada pertanyaan atau ketidaksesuaian, tanyakan ke user sebelum mark complete
