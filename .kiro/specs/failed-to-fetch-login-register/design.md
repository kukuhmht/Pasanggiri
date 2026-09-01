# Failed to Fetch Login/Register Bugfix Design

## Overview

Pada device tertentu, panggilan `supabase.auth.signInWithPassword`, `supabase.auth.signUp`, dan `fetch('/api/org/create')` di halaman `/login` dan `/register` gagal di level transport (fetch reject) dan memunculkan `TypeError: Failed to fetch` mentah pada UI. Root cause berada di sisi device (DNS gagal, ad-blocker/extension memblokir domain Supabase, VPN/proxy, service worker basi, dsb.) dan tidak dapat diperbaiki dari sisi kode. Namun UX dapat diperbaiki secara signifikan.

Strategi fix: mendeteksi kegagalan level transport, memetakannya ke pesan berbahasa Indonesia yang ramah beserta panduan pemulihan, menangani skenario partial-success di alur register (Supabase akun terbuat tapi org creation gagal), memastikan loading state di-reset, dan mencatat konteks minimal ke `console.error` untuk diagnosa. Perilaku untuk kredensial valid, kredensial invalid, dan error non-network dipertahankan tanpa perubahan.

## Glossary

- **Bug_Condition (C)**: Panggilan jaringan di alur login/register gagal di level transport (fetch reject: `TypeError` dengan pesan `Failed to fetch` atau `Network request failed`), sehingga tidak ada HTTP response yang diterima.
- **Property (P)**: UI menampilkan pesan berbahasa Indonesia yang ramah dengan panduan pemulihan, loading state di-reset, input form dipertahankan, skenario partial-success dijelaskan, dan konteks dicatat ke `console.error`.
- **Preservation**: Perilaku untuk kredensial valid, kredensial invalid (`Invalid login credentials`), error non-network lain dari Supabase, validasi client-side (password mismatch/pendek, nama org kosong), penanganan response non-OK dari `/api/org/create`, dan navigasi antar halaman.
- **Transport-level failure**: Kegagalan fetch yang terjadi sebelum response HTTP diterima; di JS ditandai dengan `TypeError` yang dilempar oleh Fetch API, bukan status code non-2xx atau error terstruktur dari Supabase.
- **login page**: `apps/web/src/app/(auth)/login/page.tsx` — memanggil `supabase.auth.signInWithPassword`.
- **register page**: `apps/web/src/app/(auth)/register/page.tsx` — memanggil `supabase.auth.signUp` lalu `fetch('/api/org/create')`.
- **isNetworkError helper**: Fungsi util baru yang mendeteksi apakah sebuah error/AuthError merupakan transport-level failure.
- **Partial-success**: Kondisi di register saat `signUp` berhasil (akun Supabase terbuat) tetapi `fetch('/api/org/create')` gagal transport, sehingga state tidak konsisten.

## Bug Details

### Bug Condition

Bug termanifestasi ketika salah satu panggilan jaringan berikut gagal di level transport pada device pengguna:
- `supabase.auth.signInWithPassword({ email, password })` di login page
- `supabase.auth.signUp({ email, password })` di register page
- `fetch('/api/org/create', ...)` di register page

Di kedua halaman, error handler saat ini menampilkan `authError.message` atau `err.message` apa adanya, sehingga string mentah `Failed to fetch` bocor ke UI. Register page bahkan tidak memiliki `try/catch` sehingga transport failure pada `signUp` atau `/api/org/create` dapat menjadi unhandled rejection.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input berupa hasil pemanggilan auth/fetch pada login atau register page
  OUTPUT: boolean

  isTransportFailure := (input.error instanceof TypeError
                         AND input.error.message CONTAINS "Failed to fetch")
                       OR (input.error.message CONTAINS "Network request failed")
                       OR (input.error.name == "AuthRetryableFetchError")

  displayedRaw := UI menampilkan input.error.message apa adanya
                  ATAU error bocor sebagai unhandled rejection

  RETURN isTransportFailure AND displayedRaw
END FUNCTION
```

### Examples

- Login: user dengan ad-blocker yang memblokir domain Supabase menekan Masuk → alert merah menampilkan `Failed to fetch`. Ekspektasi: pesan bahasa Indonesia yang menjelaskan gangguan koneksi + saran pemulihan.
- Register: user pada jaringan captive portal menekan Daftar Sekarang → `signUp` reject dengan `TypeError: Failed to fetch`. Ekspektasi: pesan ramah + form input tetap terisi.
- Register partial-success: `signUp` sukses namun `fetch('/api/org/create')` reject transport → saat ini menampilkan `Failed to fetch` (atau unhandled). Ekspektasi: pesan yang menjelaskan akun sudah dibuat tapi org creation gagal, saran login ulang / coba lagi.
- Edge case: `signInWithPassword` mengembalikan `AuthRetryableFetchError` (Supabase membungkus network error jadi AuthError dengan pesan mirip `Failed to fetch`) → saat ini bocor ke UI. Ekspektasi: dipetakan ke pesan ramah.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Login dengan kredensial valid tetap `router.push(redirectTo)` + `router.refresh()`.
- Login dengan kredensial invalid tetap menampilkan `Email atau password salah.`.
- Login dengan `authError` non-network lain tetap menampilkan `authError.message` apa adanya.
- Validasi client-side register (password tidak cocok, password < 6 karakter, nama organisasi kosong) tetap dijalankan tanpa memanggil jaringan.
- Register sukses penuh tetap `router.push('/app')` + `router.refresh()`.
- Register dengan `signUp` `authError` non-network tetap menampilkan `authError.message` apa adanya.
- `/api/org/create` yang mengembalikan response non-OK dengan body `{error}` tetap menampilkan pesan tersebut.
- Layout, styling, routing antar `/login` dan `/register` tidak berubah.

**Scope:**
Semua input yang bukan transport-level failure tidak boleh terpengaruh oleh fix ini. Ini mencakup:
- Kredensial invalid yang dikembalikan Supabase sebagai `AuthError` biasa.
- Response 4xx/5xx dari `/api/org/create` dengan body error terstruktur.
- Validasi form client-side.
- Navigasi dan render halaman.

## Hypothesized Root Cause

Bug ada di dua tempat sekaligus (bukan bug logika Supabase melainkan gap UX terhadap error transport):

1. **Login page menampilkan `authError.message` mentah**: Ketika Supabase melempar/mengembalikan network error yang pesannya `Failed to fetch`, cabang else di error handler langsung menaruhnya ke state `error`.

2. **Register page tidak punya try/catch di sekitar `signUp` dan `fetch('/api/org/create')`**: Sehingga `TypeError: Failed to fetch` menjadi unhandled promise rejection, `setIsLoading(false)` tidak pernah dipanggil, dan tombol tetap disabled. Bahkan jika error tertangkap, pesan mentah akan tampil.

3. **Tidak ada helper terpusat untuk mendeteksi transport-level failure**: Sehingga tidak konsisten membedakan `AuthError` bisnis vs `AuthRetryableFetchError`/`TypeError` transport.

4. **Skenario partial-success register tidak dibedakan**: Kegagalan `/api/org/create` setelah `signUp` sukses tidak diberi pesan khusus, padahal state (akun sudah dibuat) sangat berbeda dari kegagalan `signUp` itu sendiri.

Root cause ini device-side dari sisi transport, tapi kode-side dari sisi UX. Fix menargetkan sisi UX.

## Correctness Properties

Property 1: Bug Condition - Transport failure dipetakan ke pesan ramah

_For any_ input di alur login atau register di mana panggilan jaringan gagal di level transport (isBugCondition returns true), the fixed function SHALL menampilkan pesan berbahasa Indonesia yang ramah dengan panduan pemulihan (cek koneksi, matikan ad-blocker/VPN, refresh, coba device lain), memastikan loading state di-reset sehingga tombol submit kembali aktif, mempertahankan input form pada register, membedakan skenario partial-success (signUp OK tetapi `/api/org/create` gagal) dengan pesan khusus, dan mencatat konteks minimal (jenis operasi + pesan error asli) ke `console.error` tanpa mengekspos data sensitif ke UI.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6**

Property 2: Preservation - Non-network paths tidak berubah

_For any_ input di alur login atau register di mana bug condition TIDAK berlaku (isBugCondition returns false) — yaitu kredensial valid, kredensial invalid, `authError` non-network, validasi form client-side, atau response non-OK terstruktur dari `/api/org/create` — the fixed function SHALL menghasilkan perilaku yang sama persis dengan kode original: routing/refresh untuk sukses, pesan `Email atau password salah.` untuk invalid credentials, `authError.message` apa adanya untuk error non-network lain, pesan validasi client-side untuk input tidak valid, dan pesan `error` dari body response untuk kegagalan `/api/org/create` yang terstruktur.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

Asumsi root cause analysis benar:

**File Baru**: `apps/web/src/lib/errors/network.ts`

**Isi**:
1. **`isNetworkError(err: unknown): boolean`**
   - Return true jika `err instanceof TypeError` dan `err.message` cocok regex `/failed to fetch|network request failed|networkerror/i`.
   - Return true jika `err` adalah object dengan `name === 'AuthRetryableFetchError'`.
   - Return true jika `err` adalah `AuthError`/object dengan `message` yang cocok regex di atas (Supabase kadang membungkus `TypeError` menjadi `AuthError`).
   - Return false untuk semua kasus lain (termasuk `AuthError` bisnis seperti `Invalid login credentials`).

2. **`NETWORK_ERROR_MESSAGE` konstanta**
   - Teks bahasa Indonesia yang ramah, ~2-3 kalimat, mencakup: penjelasan singkat gangguan koneksi + panduan (periksa koneksi internet, nonaktifkan ekstensi/ad-blocker/VPN sementara, refresh halaman, atau coba device/jaringan lain).

3. **`PARTIAL_SIGNUP_MESSAGE` konstanta**
   - Teks bahasa Indonesia yang menjelaskan bahwa akun sudah berhasil dibuat namun pembuatan organisasi gagal karena gangguan jaringan, saran: coba lagi atau login ulang lalu buat organisasi.

4. **`logNetworkError(op: string, err: unknown): void`**
   - Memanggil `console.error` dengan format `[network-error][${op}]` diikuti `err`.
   - Hanya dipanggil ketika `isNetworkError(err)` true.

**File**: `apps/web/src/app/(auth)/login/page.tsx`

**Function**: handler submit form login

**Specific Changes**:
1. **Bungkus panggilan `supabase.auth.signInWithPassword` dalam `try/catch`**: `catch` menangkap `TypeError` transport yang belum tentu dibungkus Supabase. Di catch: `if (isNetworkError(err))` → `logNetworkError('login.signIn', err)` + `setError(NETWORK_ERROR_MESSAGE)` + `setIsLoading(false)` + return. Kalau bukan network error, re-throw atau tampilkan generic message.
2. **Pada cabang `authError` yang sudah ada**: sebelum menampilkan `authError.message`, cek `isNetworkError(authError)`. Kalau true → `logNetworkError('login.signIn', authError)` + `setError(NETWORK_ERROR_MESSAGE)`. Kalau false → pertahankan cabang `Invalid login credentials` → `'Email atau password salah.'` dan cabang default `authError.message` seperti sekarang.
3. **Pastikan `setIsLoading(false)` tetap tereksekusi** di semua jalur error (via `finally` atau eksplisit di tiap cabang) sehingga tombol Masuk kembali aktif.

**File**: `apps/web/src/app/(auth)/register/page.tsx`

**Function**: handler submit form register

**Specific Changes**:
1. **Tambahkan `try/catch` di sekitar seluruh blok jaringan** (`signUp` + `fetch('/api/org/create')` + parsing responsenya). Ini menutup gap unhandled rejection.
2. **Setelah `signUp`**: cek `isNetworkError(authError)` (atau tangkap `TypeError` di catch luar). Bila network error → `logNetworkError('register.signUp', err)` + `setError(NETWORK_ERROR_MESSAGE)` + return. Bila `authError` non-network → pertahankan `authError.message` seperti sekarang.
3. **Setelah `signUp` sukses, sebelum `fetch('/api/org/create')`**: tandai flag `signUpSucceeded = true` untuk membedakan partial-success di catch.
4. **Bungkus `fetch('/api/org/create')`** dalam try/catch internal (atau andalkan try/catch luar dengan flag). Bila `isNetworkError(err)` dan `signUpSucceeded` → `logNetworkError('register.orgCreate.partial', err)` + `setError(PARTIAL_SIGNUP_MESSAGE)`. Bila `isNetworkError(err)` dan !`signUpSucceeded` → tidak akan terjadi karena signUp sudah sukses, tapi sebagai defensive: `NETWORK_ERROR_MESSAGE`.
5. **Response non-OK dari `/api/org/create`** dengan body `{error}` tetap ditampilkan seperti semula (preserve).
6. **`finally` block memastikan `setIsLoading(false)`** dipanggil sehingga tombol Daftar Sekarang kembali aktif. Pertahankan state input form (jangan reset) sehingga user dapat retry tanpa mengetik ulang; ini sudah default React karena tidak ada `setEmail('')` dsb. di error path — pastikan tidak menambahnya.

## Testing Strategy

### Validation Approach

Testing mengikuti pendekatan dua fase: pertama, munculkan counterexample yang mendemonstrasikan bug pada kode belum-fixed, lalu verifikasi fix bekerja dan preservation terjaga.

### Exploratory Bug Condition Checking

**Goal**: Munculkan counterexample yang mendemonstrasikan bug SEBELUM implementasi fix, dan konfirmasi/refute root cause.

**Test Plan**: Mock `supabase.auth.signInWithPassword`, `supabase.auth.signUp`, dan global `fetch` untuk melempar `TypeError('Failed to fetch')`. Render halaman login dan register, submit form, dan periksa DOM alert box + state loading. Jalankan pada UNFIXED code untuk observe kegagalan.

**Test Cases**:
1. **Login network error**: mock `signInWithPassword` reject `TypeError('Failed to fetch')` → assert alert berisi teks ramah Indonesia, bukan `Failed to fetch` (akan gagal pada unfixed code).
2. **Register signUp network error**: mock `signUp` reject `TypeError('Failed to fetch')` → assert alert berisi teks ramah + tombol Daftar tidak stuck disabled (akan gagal pada unfixed code — kemungkinan unhandled rejection).
3. **Register partial-success**: mock `signUp` resolve OK, mock `fetch('/api/org/create')` reject `TypeError('Failed to fetch')` → assert alert menjelaskan akun sudah dibuat tetapi org creation gagal (akan gagal pada unfixed code).
4. **AuthRetryableFetchError**: mock `signInWithPassword` mengembalikan `{ error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch' } }` → assert dipetakan ke pesan ramah (akan gagal pada unfixed code).

**Expected Counterexamples**:
- Alert menampilkan `Failed to fetch` mentah.
- Tombol submit tetap disabled setelah error (loading state tidak reset) pada register.
- Kemungkinan: unhandled promise rejection di register saat signUp/orgCreate gagal transport.
- Possible causes: absennya try/catch di register, tidak ada mapping network error, tidak ada penanganan partial-success.

### Fix Checking

**Goal**: Verifikasi untuk semua input di mana bug condition berlaku, fixed function menghasilkan expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  render(page)
  submitForm(input)
  ASSERT alertText matches NETWORK_ERROR_MESSAGE OR PARTIAL_SIGNUP_MESSAGE
  ASSERT submitButton is enabled again
  ASSERT console.error was called with operation context
  ASSERT form inputs are preserved (register)
END FOR
```

### Preservation Checking

**Goal**: Verifikasi untuk semua input di mana bug condition TIDAK berlaku, fixed function menghasilkan hasil yang sama dengan original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT loginPage_original(input).effect == loginPage_fixed(input).effect
  ASSERT registerPage_original(input).effect == registerPage_fixed(input).effect
END FOR
```

**Testing Approach**: Property-based testing direkomendasikan untuk preservation checking karena:
- Menggenerate banyak kasus test otomatis melintasi domain input non-network (kredensial valid/invalid acak, response `/api/org/create` acak dengan status 2xx/4xx/5xx dan body terstruktur, kombinasi validasi form).
- Menangkap edge case yang mungkin luput dari unit test manual.
- Memberikan jaminan kuat bahwa perilaku tidak berubah untuk semua input non-buggy.

**Test Plan**: Amati perilaku pada UNFIXED code untuk skenario non-network dulu (login sukses, login invalid credentials, register validasi client-side, `/api/org/create` 400 dengan body error), lalu tulis property-based tests yang menangkap perilaku tersebut dan verifikasi tetap identik setelah fix.

**Test Cases**:
1. **Login sukses**: Amati `router.push(redirectTo)` + `router.refresh()` pada unfixed → assert perilaku sama setelah fix.
2. **Login invalid credentials**: Amati alert `Email atau password salah.` → assert identik setelah fix.
3. **Login authError non-network lain**: Amati `authError.message` ditampilkan apa adanya → assert identik setelah fix.
4. **Register validasi client-side** (password mismatch/pendek, org name kosong): Amati pesan validasi + tidak ada network call → assert identik setelah fix.
5. **Register sukses penuh**: Amati `router.push('/app')` + `router.refresh()` → assert identik setelah fix.
6. **Register `/api/org/create` response non-OK terstruktur**: Amati pesan `error` dari body response → assert identik setelah fix.

### Unit Tests

- Unit test `isNetworkError`: benar untuk `TypeError('Failed to fetch')`, `Error('Network request failed')`, `{name:'AuthRetryableFetchError'}`, `AuthError` bermessage `Failed to fetch`; salah untuk `AuthError('Invalid login credentials')`, `Error('random')`, `null`, `undefined`, string, angka.
- Unit test mapping pesan: `NETWORK_ERROR_MESSAGE` dan `PARTIAL_SIGNUP_MESSAGE` bukan string kosong dan tidak mengandung `Failed to fetch`.
- Unit test login handler: setiap cabang error (network vs invalid vs generic) memicu `setError` dengan pesan yang tepat dan `setIsLoading(false)`.
- Unit test register handler: cabang signUp-network, cabang signUp-authError non-network, cabang orgCreate-network (partial), cabang orgCreate-response-non-OK, cabang sukses penuh — tiap cabang memicu efek yang benar.

### Property-Based Tests

- Generate `AuthError` acak dengan message dan name bervariasi → property: `isNetworkError` konsisten dengan definisi (idempoten, tidak throw).
- Generate skenario login dengan kombinasi (kredensial sukses/invalid, error network/non-network) → property: untuk semua input di mana `NOT isBugCondition`, perilaku terobservasi (routing / pesan invalid / pesan generic) identik dengan baseline pra-fix.
- Generate response `/api/org/create` acak (status 200/400/401/500, body terstruktur/tidak) → property: penanganan response terstruktur non-OK identik pra dan pasca fix.

### Integration Tests

- Full flow login: submit form → mock network reject → verifikasi alert Indonesia + tombol re-enabled + `console.error` terpanggil.
- Full flow register happy path: submit form → signUp OK → orgCreate OK → `router.push('/app')`.
- Full flow register partial-success: submit form → signUp OK → orgCreate reject transport → verifikasi alert partial-success message + tombol re-enabled + akun Supabase state tidak di-cleanup (di luar scope fix ini) + `console.error` mencatat `register.orgCreate.partial`.
- Regression: navigasi antar `/login` dan `/register` tetap normal, tidak ada perubahan layout.
