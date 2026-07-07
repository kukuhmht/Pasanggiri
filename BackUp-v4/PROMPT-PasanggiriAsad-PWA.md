# Prompt: Sistem Pendaftaran & Penilaian Pasanggiri (PWA)

> **Instruksi**: Bangun ulang aplikasi ini persis seperti source code di bawah. File ini adalah dokumentasi lengkap + kode sumber yang bisa langsung di-copy untuk men-deploy ulang aplikasi.

## Ringkasan Aplikasi

**Progressive Web App (PWA) mobile-first** untuk sistem pendaftaran dan penilaian peserta lomba Pencak Silat Persinas ASAD (Pasanggiri). Backend Google Apps Script + Google Sheets. Bisa di-install sebagai aplikasi di HP/desktop.

## Stack & Arsitektur

- **Frontend**: HTML5, CSS3, Vanilla JS — single-page, 4 halaman via bottom nav
- **Backend**: Google Apps Script (Web App) — Code.gs
- **Database**: Google Sheets (5 sheet: Peserta, Penilaian, AksesJuri, Kontingen, Gelanggang)
- **PWA**: manifest.json + service-worker.js (cache-first app shell, network-only data)
- **Realtime**: Pusher (push notifikasi gelanggang aktif)
- **Font**: Google Fonts (Cinzel + Inter), Flaticon Uicons
- **Hosting**: Vercel/Netlify (static, HTTPS wajib)

## Fitur Utama

1. **Pendaftaran** — form dinamis per kategori, nomor urut otomatis
2. **Dashboard Peserta** — filter, CRUD, summary cards
3. **Penilaian** (PIN server-side) — form scoring per gelanggang aktif, rekap trimmed-mean, admin: kelola gelanggang & antrian & PIN
4. **Hasil** (publik) — juara umum (poin), peringkat per grup kategori+golongan
5. **Gelanggang & Antrian** — admin mengatur peserta tampil per gelanggang, juri melihat siapa sedang tampil
6. **Role-based access** — PIN JURI (form nilai saja) vs PIN ADMIN (semua fitur)

## Aturan Bisnis Penilaian

| Kategori | Batas Waktu | Efek melewati batas |
|---|---|---|
| PERORANGAN, BERKELOMPOK, MASSAL | 3:10 (190 dtk) | KEMANTAPAN = 20 (locked) |
| ATT | 5:00 (300 dtk) | KEMANTAPAN = 20 (locked) |
| BERPASANGAN | Ideal 2:00 | Penalti poin (lihat bawah) |

**BERPASANGAN** — penalti hanya jika > 2:00 (di bawah 2 menit = toleransi):
- Lebih 5-10 dtk: -5 poin
- Lebih 11+ dtk: -15 poin
- Keluar gelanggang: setiap 1x = -5 poin
- Semua penalti sudah dipotong sebelum disimpan ke sheet

**Nilai Akhir** (rekap): >=3 juri: trimmed mean (sum - max - min); <3 juri: sum.

**Juara Umum**: Emas x3 + Silver x2 + Perunggu x1. Tiebreaker: Emas > Silver > Perunggu.

## Setup Clone Baru

1. Buat Google Sheet kosong, copy ID
2. Buat Apps Script, paste Code.gs, ganti SPREADSHEET_ID
3. Jalankan `initSheets()` — semua sheet + seed data tercipta (PIN default: `335544`)
4. Deploy Web App (Execute as Me, Anyone)
5. Edit config.js: `APPS_SCRIPT_URL`, `SPREADSHEET_ID`, `EVENT`
6. Deploy frontend ke Vercel/Netlify
7. Kelola kontingen & PIN langsung di Google Sheets

## Catatan Penting

- PIN tidak boleh ada di frontend — validasi 100% di Apps Script
- Kontingen di-fetch dari server (sheet `Kontingen`) — bukan hardcode
- Nama Juri wajib diisi manual — tidak auto-fill dari dropdown
- Tidak ada field Nama Pelatih / Nomor WhatsApp di form pendaftaran
- Footer: WhatsApp `wa.me/628112049902`, Instagram `@kkmht25`, Threads `@kkmht25`
- Modal PIN: support link ke `https://lynk.id/kkmht/n7nd13n58nx2`
- Naikkan `CACHE_VERSION` di service-worker.js setiap deploy perubahan
- Pusher key & cluster dikonfigurasi di `config.js` untuk realtime gelanggang

---

## SOURCE CODE (Versi Lengkap)

> Copy seluruh kode berikut untuk mereproduksi aplikasi persis.

### `config.js`

```js
/* ==========================================================================
 * config.js — Konfigurasi Aplikasi Pasanggiri Persinas ASAD
 * --------------------------------------------------------------------------
 * Ini adalah SATU-SATUNYA file yang perlu diubah saat cloning untuk event baru.
 *
 * ⚠️  PENTING: File ini TIDAK BOLEH menyimpan PIN dalam bentuk apapun.
 *     PIN sepenuhnya dikelola di sisi server (Apps Script + sheet `AksesJuri`).
 * ========================================================================== */

const CONFIG = {
  /* ------------------------------------------------------------------ *
   * WAJIB DIGANTI saat clone untuk event baru
   * ------------------------------------------------------------------ */

  // URL deploy Apps Script Web App (akhiri dengan /exec)
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/GANTI_DENGAN_DEPLOY_ID/exec',

  // ID Google Spreadsheet (lihat di URL spreadsheet)
  SPREADSHEET_ID: 'GANTI_DENGAN_ID_SPREADSHEET',

  // Identitas event (tampil di header & PWA)
  EVENT: {
    nama: 'Pasanggiri Persinas ASAD',
    subjudul: 'Sistem Pendaftaran dan Penilaian',
    tahun: 2026
  },

  // Daftar kontingen dikelola langsung di Google Sheets → sheet "Kontingen" (Nama | Kode)
  // Tidak perlu diubah di sini.

  // Daftar golongan usia
  GOLONGAN: [
    { nama: 'Usia Dini', kode: 'UDN' },
    { nama: 'Pra Remaja', kode: 'PRM' },
    { nama: 'Remaja', kode: 'RMJ' },
    { nama: 'Dewasa', kode: 'DWS' },
    { nama: 'Pembina', kode: 'PBN' },
    { nama: 'Istimewa', kode: 'IST' }
  ],

  // Golongan khusus yang HANYA tersedia untuk kategori tertentu.
  // Contoh: "Campuran" hanya untuk MASSAL.
  GOLONGAN_KHUSUS: {
    'MASSAL': [
      { nama: 'Campuran', kode: 'CMP' }
    ]
  },

  // Override jumlah minimal peserta bila golongan tertentu dipilih.
  // (max tetap mengikuti kategori). Contoh: Campuran minimal 10 peserta.
  GOLONGAN_MIN_PESERTA: {
    'Campuran': 10
  },

  // Daftar juri yang tersedia
  JURI_LIST: ['Juri 1', 'Juri 2', 'Juri 3', 'Juri 4', 'Juri 5'],

  /* ------------------------------------------------------------------ *
   * DATA REFERENSI — biasanya tetap antar event (jangan ubah key)
   * ------------------------------------------------------------------ */

  KATEGORI: [
    { nama: 'PERORANGAN',  kode: 'PER', min: 1, max: 1 },
    { nama: 'BERPASANGAN', kode: 'BPS', min: 2, max: 2 },
    { nama: 'BERKELOMPOK', kode: 'BKL', min: 3, max: 5 },
    { nama: 'MASSAL',      kode: 'MSL', min: 8, max: 25 },
    { nama: 'ATT',         kode: 'ATT', min: 6, max: 6 }
  ],

  // Kriteria master (key stabil, jangan ubah key)
  KRITERIA_PENILAIAN: [
    { nama: 'ORISINALITAS',       key: 'orisinalitas',     min: 14, max: 50 },
    { nama: 'KEMANTAPAN',         key: 'kemantapan',       min: 20, max: 25 },
    { nama: 'STAMINA',            key: 'stamina',          min: 20, max: 25 },
    { nama: 'KEKOMPAKAN',         key: 'kekompakan',       min: 14, max: 25 },
    { nama: 'KREATIFITAS',        key: 'kreatifitas',      min: 20, max: 25 },
    { nama: 'KEKAYAAN TEKNIK',    key: 'kekayaanTeknik',   min: 20, max: 25 },
    { nama: 'TEKNIK SERANG BELA', key: 'teknikSerangBela', min: 45, max: 50 },
    { nama: 'PENGHAYATAN',        key: 'penghayatan',      min: 20, max: 25 }
  ],

  // Kriteria aktif per kategori
  KRITERIA_PER_KATEGORI: {
    'PERORANGAN':  ['orisinalitas', 'kemantapan', 'stamina'],
    'BERPASANGAN': ['teknikSerangBela', 'kemantapan', 'penghayatan'],
    'BERKELOMPOK': ['orisinalitas', 'kemantapan', 'kekompakan'],
    'MASSAL':      ['orisinalitas', 'kemantapan', 'kekompakan', 'kreatifitas'],
    'ATT':         ['orisinalitas', 'kemantapan', 'kekayaanTeknik']
  },

  // Override range ORISINALITAS per kategori
  ORISINALITAS_RANGE: {
    'MASSAL':  { min: 14, max: 25 },
    'DEFAULT': { min: 39, max: 50 } // untuk PERORANGAN, BERKELOMPOK, ATT
  },

  // Batas waktu tampil (selain BERPASANGAN): jika > batas → KEMANTAPAN otomatis 20
  WAKTU_TAMPIL_BATAS_DETIK: 190,      // PERORANGAN, BERKELOMPOK, MASSAL → 3:10
  WAKTU_TAMPIL_BATAS_ATT: 300,         // ATT → 5:00
  KEMANTAPAN_DEFAULT_LEBIH_WAKTU: 20,

  // Aturan khusus BERPASANGAN — waktu ideal 2:00
  BERPASANGAN_WAKTU: {
    IDEAL_DETIK: 120,
    PENALTI: [
      { minSelisih: 5,  maxSelisih: 10,       potong: 5  },
      { minSelisih: 11, maxSelisih: Infinity, potong: 15 }
    ]
  },

  // Penalti keluar gelanggang khusus BERPASANGAN: setiap keluar = −5 poin
  BERPASANGAN_KELUAR_GELANGGANG_POIN: 5,

  // Ambang warna Total Nilai (live)
  TOTAL_WARNA: { MID: 210, HIGH: 230 },

  // Pusher real-time (satu channel global)
  PUSHER: {
    APP_KEY: '8eebb0f44e0e727467db',
    CLUSTER: 'ap1'
  }
};

// Ekspor global (dipakai app.js)
window.CONFIG = CONFIG;
```

### `index.html`

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Pasanggiri Persinas ASAD</title>
  <meta name="description" content="Sistem Pendaftaran & Penilaian Pasanggiri Persinas ASAD" />

  <!-- PWA -->
  <link rel="manifest" href="manifest.json" />
  <meta name="theme-color" content="#1B4332" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="Pasanggiri" />
  <link rel="apple-touch-icon" href="icons/icon-192.png" />
  <link rel="icon" type="image/png" href="icons/icon-192.png" />

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

  <!-- Flaticon Uicons (brands) -->
  <link rel="stylesheet" href="https://cdn-uicons.flaticon.com/uicons-brands/css/uicons-brands.css" />

  <link rel="stylesheet" href="style.css" />
</head>
<body>

  <!-- ===================== HEADER ===================== -->
  <header class="app-header">
    <div class="header-inner">
      <h1 class="app-title" id="appTitle">Pasanggiri ASAD</h1>
      <p class="app-subtitle" id="appSubtitle">Sistem Pendaftaran dan Penilaian</p>
    </div>
    <div class="batik-border"></div>
  </header>

  <!-- ===================== MAIN ===================== -->
  <main class="app-main">

    <!-- ============ HALAMAN 1: PENDAFTARAN ============ -->
    <section id="page-form" class="page active">
      <div class="card">
        <button type="button" class="btn-secondary" id="btnTogglePeraturan">📖 Lihat Peraturan Pasanggiri</button>
        <div id="peraturanWrap" class="peraturan-wrap hidden">
          <iframe id="peraturanFrame" title="Peraturan Pasanggiri"></iframe>
        </div>
      </div>

      <div class="card">
        <h2 class="card-title">📝 Pendaftaran Peserta</h2>
        <form id="formPendaftaran" autocomplete="off">
          <div class="field">
            <label for="f-kategori">Kategori</label>
            <select id="f-kategori" required></select>
          </div>
          <div class="field">
            <label for="f-golongan">Golongan</label>
            <select id="f-golongan" required></select>
          </div>
          <div class="field">
            <label for="f-kontingen">Kontingen</label>
            <select id="f-kontingen" required></select>
          </div>

          <div class="field">
            <label>Nama Peserta <span id="pesertaCount" class="muted-inline"></span></label>
            <div id="pesertaInputs" class="peserta-inputs"></div>
            <div id="pesertaControls" class="peserta-controls hidden">
              <button type="button" class="btn-mini" id="btnKurangPeserta">−</button>
              <button type="button" class="btn-mini" id="btnTambahPeserta">+</button>
            </div>
          </div>


          <button type="submit" class="btn-primary" id="btnSubmitDaftar">Daftar Peserta</button>
        </form>
      </div>
    </section>

    <!-- ============ HALAMAN 2: DASHBOARD ============ -->
    <section id="page-dashboard" class="page">
      <div class="card">
        <h2 class="card-title">🥋 Data Peserta</h2>
        <div class="filter-row">
          <select id="d-filter-kategori"></select>
          <select id="d-filter-golongan"></select>
          <select id="d-filter-kontingen"></select>
          <button class="btn-mini" id="btnRefreshDashboard" title="Muat ulang">↻</button>
        </div>
        <div id="summaryCards" class="summary-cards"></div>
      </div>
      <div class="card">
        <div class="table-scroll">
          <table id="tablePeserta" class="data-table">
            <thead>
              <tr>
                <th>No. Urut</th><th>Kategori</th><th>Golongan</th><th>Peserta</th><th>Aksi</th>
              </tr>
            </thead>
            <tbody id="tablePesertaBody"></tbody>
          </table>
        </div>
        <div id="dashboardEmpty" class="empty-state hidden">Belum ada peserta.</div>
      </div>
    </section>

    <!-- ============ HALAMAN 3: PENILAIAN ============ -->
    <section id="page-penilaian" class="page">
      <!-- konten hanya tampil jika token valid; jika tidak, modal PIN muncul -->
      <div id="penilaianLocked" class="locked-hint hidden">
        <p>🔒 Halaman penilaian terkunci. Masukkan PIN untuk masuk.</p>
        <button class="btn-primary" id="btnBukaPin">Masukkan PIN</button>
      </div>

      <div id="penilaianContent" class="hidden">
        <div class="card">
          <div class="penilaian-head">
            <h2 class="card-title">👨🏼‍🏫 Penilaian</h2>
            <div class="penilaian-head-right">
              <span id="pusherStatus" class="pusher-dot" title="Real-time: menghubungkan...">⚪</span>
              <span id="roleBadge" class="role-badge"></span>
              <button class="btn-lock" id="btnKunci" title="Kunci halaman">🔒 Kunci</button>
            </div>
          </div>
          <div class="subtabs" id="subtabs">
            <button class="subtab active" data-subtab="form" data-role="JURI">Form Nilai</button>
            <button class="subtab" data-subtab="rekap" data-role="JURI">Rekap Nilai</button>
            <button class="subtab" data-subtab="antrian" data-role="ADMIN">Antrian &amp; Gelanggang</button>
            <button class="subtab" data-subtab="pin" data-role="ADMIN">Generate PIN Juri</button>
          </div>
        </div>

        <!-- SUB-TAB: FORM NILAI (berbasis gelanggang & peserta aktif) -->
        <div id="subtab-form" class="subtab-panel active">
          <div class="card">
            <h3 class="step-title">Langkah 1 — Pilih Gelanggang</h3>
            <div class="filter-row">
              <select id="fn-gelanggang"><option value="">Pilih gelanggang…</option></select>
              <button class="btn-mini" id="btnRefreshAktif" title="Muat ulang peserta aktif">↻</button>
            </div>
            <div id="pesertaAktifKosong" class="empty-state hidden">
              Belum ada peserta tampil di Gelanggang ini. Hubungi Admin/Panitia.
            </div>
            <div id="pesertaTerpilih" class="peserta-info hidden"></div>
          </div>

          <div id="step2" class="card hidden">
            <h3 class="step-title">Langkah 2 — Pilih Juri</h3>
            <div id="juriBadges" class="juri-badges"></div>
            <div class="field">
              <label for="pilihJuri">Posisi Juri</label>
              <select id="pilihJuri"></select>
            </div>
            <div class="field">
              <label for="namaJuri">Nama Juri</label>
              <input type="text" id="namaJuri" placeholder="Nama lengkap juri" />
            </div>
          </div>

          <div id="step3" class="card hidden">
            <h3 class="step-title">Langkah 3 — Input Nilai</h3>
            <div id="kriteriaInputs" class="kriteria-inputs"></div>

            <div class="field">
              <label>Waktu Tampil (mm:ss)</label>
              <div class="waktu-inputs">
                <input type="number" id="waktuMenit" min="0" max="59" placeholder="mm" inputmode="numeric" />
                <span class="waktu-sep">:</span>
                <input type="number" id="waktuDetik" min="0" max="59" placeholder="ss" inputmode="numeric" />
              </div>
              <div id="waktuNotif" class="notif-inline"></div>
            </div>

            <div id="keluarGelanggangField" class="field hidden">
              <label for="keluarGelanggang">Keluar Gelanggang (kali)</label>
              <input type="number" id="keluarGelanggang" min="0" value="0" inputmode="numeric" />
              <div id="keluarNotif" class="notif-inline"></div>
            </div>

            <div class="total-box">
              <span>Total Nilai</span>
              <span id="totalNilai" class="total-value">0</span>
            </div>

            <button type="button" class="btn-primary" id="btnSimpanNilai">Simpan Penilaian</button>
          </div>
        </div>

        <!-- SUB-TAB: REKAP NILAI -->
        <div id="subtab-rekap" class="subtab-panel">
          <div class="card">
            <h3 class="step-title">Rekap Nilai</h3>
            <div class="filter-row">
              <select id="r-filter-golongan"></select>
              <select id="r-filter-kategori"></select>
              <button class="btn-mini" id="btnRefreshRekap" title="Muat ulang">↻</button>
            </div>
            <p class="rekap-hint" id="rekapHint">Mode Admin: klik sel kriteria untuk mengedit langsung (seperti spreadsheet). Tersimpan otomatis saat berpindah sel.</p>
          </div>
          <div class="card">
            <div class="table-scroll">
              <table id="tableRekap" class="data-table compact rekap-ss">
                <thead>
                  <tr>
                    <th>No. Urut</th><th>Nama</th><th>Kontingen</th><th>Kat</th><th>Gol</th>
                    <th>Juri</th><th>Nama Juri</th><th>Waktu</th><th title="Keluar Gelanggang">KG</th>
                    <th title="Orisinalitas">ORI</th><th title="Kemantapan">KMT</th><th title="Stamina">STM</th>
                    <th title="Kekompakan">KKP</th><th title="Kreatifitas">KRF</th><th title="Kekayaan Teknik">KKT</th>
                    <th title="Teknik Serang Bela">TSB</th><th title="Penghayatan">PGH</th>
                    <th>Total</th>
                    <th>Tertinggi</th><th>Terendah</th><th>Orisinalitas</th><th title="Jumlah Juri">Σ Juri</th><th>Nilai Akhir</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody id="tableRekapBody"></tbody>
              </table>
            </div>
            <div id="rekapEmpty" class="empty-state hidden">Belum ada penilaian.</div>
          </div>
        </div>

        <!-- SUB-TAB: ANTRIAN & GELANGGANG (Admin only) -->
        <div id="subtab-antrian" class="subtab-panel">
          <div class="card">
            <div class="penilaian-head">
              <h3 class="step-title" style="margin:0">🏟️ Gelanggang &amp; Antrian Tampil</h3>
              <button class="btn-lock" id="btnTambahGelanggang">+ Gelanggang</button>
            </div>
          </div>
          <div id="gelanggangList"></div>
          <div id="gelanggangEmpty" class="card empty-state hidden">
            Belum ada gelanggang. Klik "+ Gelanggang" untuk membuat.
          </div>
        </div>

        <!-- SUB-TAB: GENERATE PIN JURI (Admin only) -->
        <div id="subtab-pin" class="subtab-panel">
          <div class="card">
            <h3 class="step-title">🔑 Generate PIN Juri</h3>
            <div class="field">
              <label for="gp-keterangan">Keterangan (label PIN)</label>
              <input type="text" id="gp-keterangan" placeholder="contoh: Juri 1 — Event Juni 2026" />
            </div>
            <div class="field">
              <label for="gp-berlaku">Berlaku Hingga (opsional)</label>
              <input type="date" id="gp-berlaku" />
            </div>
            <button class="btn-primary" id="btnGeneratePin">Generate PIN</button>
            <div id="gp-result" class="gp-result hidden">
              <div class="gp-result-label">PIN Juri Baru</div>
              <div class="gp-result-pin" id="gp-pin-value">------</div>
              <button class="btn-secondary" id="btnCopyPin">📋 Salin PIN</button>
            </div>
          </div>
          <div class="card">
            <div class="penilaian-head">
              <h3 class="step-title" style="margin:0">Daftar PIN Juri</h3>
              <button class="btn-mini" id="btnRefreshPin" title="Muat ulang">↻</button>
            </div>
            <div class="table-scroll">
              <table class="data-table compact">
                <thead>
                  <tr><th>PIN</th><th>Keterangan</th><th>Status</th><th>Terakhir Dipakai</th><th>Aksi</th></tr>
                </thead>
                <tbody id="pinListBody"></tbody>
              </table>
            </div>
            <div id="pinListEmpty" class="empty-state hidden">Belum ada PIN Juri dibuat.</div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ HALAMAN 4: HASIL ============ -->
    <section id="page-hasil" class="page">
      <div class="card">
        <h2 class="card-title">🏆 Hasil &amp; Juara</h2>
        <div class="filter-row">
          <select id="h-filter-kategori"></select>
          <select id="h-filter-golongan"></select>
          <button class="btn-mini" id="btnRefreshHasil" title="Muat ulang">↻</button>
        </div>
      </div>
      <div class="card">
        <h3 class="step-title">👑 Juara Umum (Kontingen)</h3>
        <div id="juaraUmum" class="juara-umum"></div>
      </div>
      <div id="hasilGroups"></div>
    </section>

  </main>

  <!-- ===================== FOOTER ===================== -->
  <footer class="app-footer">
    <div class="footer-links">
      <a href="https://wa.me/628112049902" target="_blank" rel="noopener">
        <i class="fi fi-brands-whatsapp"></i> WhatsApp
      </a>
      <a href="https://instagram.com/kkmht25" target="_blank" rel="noopener">
        <i class="fi fi-brands-instagram"></i> Instagram
      </a>
    </div>
    <p class="footer-copy">&copy; 2026 kukuhmht - Bandung Utara</p>
  </footer>

  <!-- ===================== BOTTOM NAV ===================== -->
  <nav class="bottom-nav">
    <button class="nav-btn active" data-page="page-form"><span class="nav-ico">📝</span><span class="nav-lbl">Daftar</span></button>
    <button class="nav-btn" data-page="page-dashboard"><span class="nav-ico">🥋</span><span class="nav-lbl">Peserta</span></button>
    <button class="nav-btn" data-page="page-penilaian"><span class="nav-ico">👨🏼‍🏫</span><span class="nav-lbl">Penilaian</span></button>
    <button class="nav-btn" data-page="page-hasil"><span class="nav-ico">🏆</span><span class="nav-lbl">Hasil</span></button>
  </nav>

  <!-- ===================== MODAL PIN ===================== -->
  <div id="pinModal" class="modal-overlay hidden">
    <div class="modal pin-modal">
      <button class="pin-close" id="pinCloseBtn" title="Tutup">✕</button>
      <div class="pin-logo">🔐</div>
      <h2 class="pin-title">Akses Juri</h2>
      <p class="pin-desc">Masukkan PIN untuk membuka halaman penilaian.</p>
      <div class="pin-info-box">
        <p>⚠️ Fitur Penilaian Juri memerlukan PIN akses.</p>
        <p>Berikan support untuk mendapatkan PIN:</p>
        <a href="https://lynk.id/kkmht/n7nd13n58nx2" target="_blank" rel="noopener" class="pin-wa-link">
          ☕ Support & Request PIN
        </a>
      </div>
      <form id="pinForm">
        <input type="password" id="pinInput" class="pin-input" inputmode="numeric"
               maxlength="6" placeholder="••••••" autocomplete="off" />
        <div id="pinError" class="pin-error"></div>
        <button type="submit" class="btn-primary pin-submit" id="pinSubmitBtn">Masuk</button>
      </form>
    </div>
  </div>

  <!-- ===================== MODAL EDIT PESERTA ===================== -->
  <div id="editPesertaModal" class="modal-overlay hidden">
    <div class="modal">
      <div class="modal-head">
        <h3 id="editPesertaTitle">Edit Peserta</h3>
        <button class="modal-close" data-close="editPesertaModal">✕</button>
      </div>
      <div class="modal-body" id="editPesertaBody"></div>
    </div>
  </div>

  <!-- ===================== MODAL EDIT NILAI ===================== -->
  <div id="editNilaiModal" class="modal-overlay hidden">
    <div class="modal">
      <div class="modal-head">
        <h3 id="editNilaiTitle">Edit Nilai</h3>
        <button class="modal-close" data-close="editNilaiModal">✕</button>
      </div>
      <div class="modal-body" id="editNilaiBody"></div>
    </div>
  </div>

  <!-- ===================== MODAL TAMBAH ANTRIAN ===================== -->
  <div id="addAntrianModal" class="modal-overlay hidden">
    <div class="modal">
      <div class="modal-head">
        <h3 id="addAntrianTitle">Tambah Peserta ke Antrian</h3>
        <button class="modal-close" data-close="addAntrianModal">✕</button>
      </div>
      <div class="modal-body">
        <div class="field">
          <label for="aa-cari">Cari peserta (nama / nomor urut)</label>
          <input type="text" id="aa-cari" placeholder="Ketik nama atau nomor urut..." autocomplete="off" />
          <div id="aa-list" class="autocomplete-list"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- ===================== TOAST ===================== -->
  <div id="toast" class="toast hidden"></div>

  <!-- ===================== LOADING OVERLAY ===================== -->
  <div id="globalLoader" class="global-loader hidden"><div class="spinner"></div></div>

  <script src="https://js.pusher.com/8.4.0/pusher.min.js"></script>
  <script src="config.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

### `style.css`

```css
/* ==========================================================================
 * style.css — Pasanggiri Persinas ASAD
 * Tema: Seni tradisional Sunda (hijau tua, emas, krem, putih gading)
 * ========================================================================== */

:root {
  --hijau-tua: #1B4332;
  --hijau-sedang: #2D6A4F;
  --emas: #B8860B;
  --emas-terang: #D4A843;
  --krem: #FFF8F0;
  --putih-gading: #FEFCF3;
  --coklat: #5C4033;
  --merah-error: #C0392B;
  --radius: 10px;
  --shadow: 0 2px 8px rgba(27, 67, 50, 0.12);
  --nav-h: 64px;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body { height: 100%; }

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: var(--krem);
  color: #233;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  padding-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom));
}

h1, h2, h3 { font-family: 'Cinzel', serif; }

input, select, button, textarea { font-family: inherit; font-size: 16px; }

.hidden { display: none !important; }
.muted-inline { font-weight: 400; font-size: 12px; color: var(--coklat); }

/* ===================== HEADER ===================== */
.app-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: linear-gradient(135deg, var(--hijau-tua), var(--hijau-sedang));
  color: var(--putih-gading);
  padding-top: env(safe-area-inset-top);
}
.header-inner { padding: 14px 18px 12px; text-align: center; }
.app-title { font-size: 22px; font-weight: 700; letter-spacing: 1px; color: var(--emas-terang); }
.app-subtitle { font-size: 12px; opacity: 0.9; margin-top: 2px; }
.batik-border {
  height: 6px;
  background-image: repeating-linear-gradient(
    45deg, var(--emas) 0 8px, var(--emas-terang) 8px 16px
  );
}

/* ===================== MAIN / PAGES ===================== */
.app-main { max-width: 720px; margin: 0 auto; padding: 14px; }
.page { display: none; animation: fade 0.25s ease; }
.page.active { display: block; }
@keyframes fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

/* ===================== CARD ===================== */
.card {
  background: var(--putih-gading);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  border-left: 4px solid var(--emas);
  padding: 16px;
  margin-bottom: 14px;
}
.card-title { color: var(--hijau-tua); font-size: 18px; margin-bottom: 14px; }
.step-title { color: var(--hijau-sedang); font-size: 15px; margin-bottom: 12px; }

/* ===================== FIELDS ===================== */
.field { margin-bottom: 14px; }
.field label { display: block; font-size: 13px; font-weight: 600; color: var(--coklat); margin-bottom: 5px; }
.field input, .field select {
  width: 100%;
  padding: 11px 12px;
  border: 1.5px solid #d8d0c0;
  border-radius: var(--radius);
  background: #fff;
  transition: border-color 0.15s;
}
.field input:focus, .field select:focus { outline: none; border-color: var(--emas); }
.field input.invalid { border-color: var(--merah-error); background: #fdeeee; }

.peserta-inputs { display: flex; flex-direction: column; gap: 8px; }
.peserta-inputs input { width: 100%; }
.peserta-controls { display: flex; gap: 8px; margin-top: 8px; }

.waktu-inputs { display: flex; align-items: center; gap: 8px; }
.waktu-inputs input { width: 80px; text-align: center; }
.waktu-sep { font-size: 22px; font-weight: 700; color: var(--coklat); }

.notif-inline { font-size: 13px; margin-top: 6px; color: var(--merah-error); font-weight: 600; min-height: 0; }
.notif-inline.ok { color: var(--hijau-sedang); }

/* ===================== BUTTONS ===================== */
.btn-primary, .btn-secondary {
  width: 100%;
  padding: 13px;
  border: none;
  border-radius: var(--radius);
  font-weight: 700;
  cursor: pointer;
  margin-top: 6px;
  transition: filter 0.15s, transform 0.05s;
}
.btn-primary { background: var(--hijau-tua); color: var(--emas-terang); }
.btn-primary:active { transform: scale(0.99); }
.btn-primary:hover { filter: brightness(1.1); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: transparent; color: var(--hijau-tua); border: 1.5px solid var(--hijau-sedang); }
.btn-mini {
  min-width: 40px; height: 40px; border: 1.5px solid #d8d0c0; background: #fff;
  border-radius: var(--radius); font-size: 18px; font-weight: 700; cursor: pointer; color: var(--hijau-tua);
}
.btn-mini:hover { background: var(--krem); }
.btn-lock { background: var(--emas); color: #fff; border: none; padding: 7px 12px; border-radius: var(--radius); font-weight: 700; cursor: pointer; font-size: 13px; }

.btn-icon { background: none; border: none; cursor: pointer; font-size: 16px; padding: 4px 6px; border-radius: 6px; }
.btn-icon:hover { background: #00000010; }

/* ===================== PERATURAN IFRAME ===================== */
.peraturan-wrap { margin-top: 10px; }
.peraturan-wrap iframe { width: 100%; height: 60vh; border: 1px solid #d8d0c0; border-radius: var(--radius); }

/* ===================== FILTER ROW ===================== */
.filter-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.filter-row select { flex: 1; min-width: 120px; padding: 9px 10px; border: 1.5px solid #d8d0c0; border-radius: var(--radius); background: #fff; }

/* ===================== SUMMARY CARDS ===================== */
.summary-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
.summary-card { background: linear-gradient(135deg, var(--hijau-tua), var(--hijau-sedang)); color: var(--putih-gading); border-radius: var(--radius); padding: 12px; text-align: center; }
.summary-card .num { font-size: 24px; font-weight: 800; color: var(--emas-terang); font-family: 'Cinzel', serif; }
.summary-card .lbl { font-size: 11px; opacity: 0.9; margin-top: 2px; }

/* ===================== TABLE ===================== */
.table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; white-space: nowrap; }
.data-table.compact { font-size: 12px; }
.data-table thead th { background: var(--hijau-tua); color: var(--putih-gading); padding: 9px 8px; text-align: left; font-weight: 600; position: sticky; top: 0; }
.data-table tbody td { padding: 8px; border-bottom: 1px solid #eadfce; }
.data-table tbody tr:nth-child(even) { background: #faf4e9; }
.data-table tbody tr:hover { background: #f3e9d6; }
.rank-1 { background: linear-gradient(90deg, #fff6d6, transparent) !important; }
.rank-2 { background: linear-gradient(90deg, #eef0f2, transparent) !important; }
.rank-3 { background: linear-gradient(90deg, #f6e6d6, transparent) !important; }

.empty-state { text-align: center; color: var(--coklat); padding: 24px; font-size: 14px; }

/* ===================== PENILAIAN ===================== */
.penilaian-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.locked-hint { text-align: center; padding: 32px 16px; }
.locked-hint p { margin-bottom: 16px; color: var(--coklat); }

.subtabs { display: flex; gap: 8px; }
.subtab { flex: 1; padding: 10px; border: none; background: #ece2d0; color: var(--coklat); border-radius: var(--radius); font-weight: 700; cursor: pointer; }
.subtab.active { background: var(--hijau-tua); color: var(--emas-terang); }
.subtab-panel { display: none; }
.subtab-panel.active { display: block; }

/* Autocomplete */
.autocomplete-list { position: relative; }
.autocomplete-list .ac-item { padding: 10px 12px; border: 1px solid #eadfce; border-top: none; background: #fff; cursor: pointer; font-size: 14px; }
.autocomplete-list .ac-item:first-child { border-top: 1px solid #eadfce; border-radius: var(--radius) var(--radius) 0 0; }
.autocomplete-list .ac-item:last-child { border-radius: 0 0 var(--radius) var(--radius); }
.autocomplete-list .ac-item:hover { background: var(--krem); }
.ac-item small { color: var(--coklat); }

.peserta-info { background: var(--krem); border: 1px dashed var(--emas); border-radius: var(--radius); padding: 12px; font-size: 13px; line-height: 1.7; }
.peserta-info b { color: var(--hijau-tua); }

/* Juri badges */
.juri-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.juri-badge { padding: 6px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; background: #d9d2c4; color: #555; }
.juri-badge.done { background: var(--hijau-sedang); color: #fff; }

/* Kriteria inputs */
.kriteria-inputs { display: flex; flex-direction: column; gap: 12px; margin-bottom: 14px; }
.kriteria-item label { display: flex; justify-content: space-between; align-items: baseline; }
.kriteria-item .range-hint { font-size: 11px; color: var(--coklat); font-weight: 500; }
.kriteria-item input[readonly] { background: #efe9dc; color: #777; }

/* Total box */
.total-box { display: flex; justify-content: space-between; align-items: center; background: var(--hijau-tua); color: #fff; padding: 14px 16px; border-radius: var(--radius); margin: 8px 0 12px; }
.total-box span:first-child { font-weight: 600; }
.total-value { font-size: 26px; font-weight: 800; font-family: 'Cinzel', serif; color: #cfcfcf; }
.total-value.total-mid { color: var(--emas-terang); }
.total-value.total-high { color: #6BCB77; }
.total-value .penalti { font-size: 15px; color: #ff9b8a; margin-left: 6px; }

/* ===================== HASIL ===================== */
.juara-umum { margin-bottom: 8px; }
.juara-list { display: flex; flex-direction: column; gap: 10px; }
.juara-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--putih-gading);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  border-left: 4px solid #ddd;
}
.juara-row.juara-emas {
  background: linear-gradient(135deg, #fffbe6, #fff3c4);
  border-left-color: #FFD700;
}
.juara-row.juara-silver {
  background: linear-gradient(135deg, #f8f8f8, #eaeaea);
  border-left-color: #B0B0B0;
}
.juara-row.juara-perunggu {
  background: linear-gradient(135deg, #fdf5ed, #f6e6d4);
  border-left-color: #CD7F32;
}

.juara-rank { min-width: 48px; text-align: center; flex-shrink: 0; }
.juara-medal { font-size: 28px; display: block; line-height: 1.2; }
.juara-pos { font-size: 11px; font-weight: 700; color: var(--coklat); }

.juara-body { flex: 1; min-width: 0; }
.juara-nama {
  font-size: 17px;
  font-weight: 800;
  color: var(--hijau-tua);
  font-family: 'Cinzel', serif;
  margin-bottom: 3px;
}
.juara-medali { font-size: 14px; color: var(--coklat); }

.juara-poin { text-align: right; flex-shrink: 0; padding-left: 8px; }
.juara-poin-label { font-size: 10px; font-weight: 700; color: var(--coklat); letter-spacing: 0.5px; margin-bottom: 2px; }
.juara-poin-value {
  font-size: 26px;
  font-weight: 800;
  font-family: 'Cinzel', serif;
  color: var(--hijau-tua);
  line-height: 1;
}
.juara-emas .juara-poin-value { color: #B8860B; }
.juara-silver .juara-poin-value { color: #666; }
.juara-perunggu .juara-poin-value { color: #CD7F32; }

.juara-keterangan {
  font-size: 11px;
  color: var(--coklat);
  font-style: italic;
  text-align: center;
  margin-top: 12px;
  padding: 0 8px;
  line-height: 1.5;
}

/* Hasil group */
.hasil-group { margin-bottom: 20px; }
.hasil-group-header {
  background: linear-gradient(135deg, var(--hijau-tua), var(--hijau-sedang));
  border: 2px solid var(--emas);
  border-radius: var(--radius);
  padding: 12px 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-bottom: 12px;
}
.hgh-pill {
  font-size: 13px;
  color: var(--putih-gading);
  padding: 4px 12px;
  border-radius: 20px;
  background: rgba(255,255,255,0.1);
}
.hgh-pill b { color: var(--emas-terang); margin-left: 4px; }

.hasil-group-cards { display: flex; flex-direction: column; gap: 10px; }

/* Hasil card */
.hasil-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--putih-gading);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 14px;
  border-left: 4px solid #ddd;
  transition: box-shadow 0.15s;
}
.hasil-card:hover { box-shadow: 0 4px 16px rgba(27, 67, 50, 0.15); }
.hasil-card.r1 { border-left-color: #FFD700; background: linear-gradient(90deg, #fffbeb, var(--putih-gading)); }
.hasil-card.r2 { border-left-color: #B0B0B0; background: linear-gradient(90deg, #f7f7f7, var(--putih-gading)); }
.hasil-card.r3 { border-left-color: #CD7F32; background: linear-gradient(90deg, #fdf3ea, var(--putih-gading)); }

/* Rank area (left) */
.hc-rank {
  min-width: 56px;
  text-align: center;
  flex-shrink: 0;
}
.hc-medal-icon { font-size: 30px; line-height: 1.2; }
.hc-medal-label { font-size: 10px; font-weight: 800; color: var(--coklat); letter-spacing: 0.5px; margin-top: 2px; }
.hc-rank-num {
  width: 38px; height: 38px;
  border-radius: 50%;
  background: #e8e0d4;
  color: var(--hijau-tua);
  font-weight: 800;
  font-size: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: 'Cinzel', serif;
}

/* Body area (middle) */
.hasil-card .hc-body { flex: 1; min-width: 0; }
.hasil-card .hc-nama {
  font-weight: 700;
  font-size: 15px;
  color: var(--hijau-tua);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}
.hasil-card .hc-meta {
  font-size: 12px;
  color: var(--coklat);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hasil-card .hc-juri {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

/* Score area (right) */
.hc-score {
  text-align: right;
  flex-shrink: 0;
  padding-left: 8px;
}
.hc-score-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--coklat);
  letter-spacing: 0.3px;
  margin-bottom: 2px;
}
.hc-score-value {
  font-size: 28px;
  font-weight: 800;
  font-family: 'Cinzel', serif;
  color: var(--hijau-tua);
  line-height: 1;
}
.hasil-card.r1 .hc-score-value { color: #B8860B; }
.hasil-card.r2 .hc-score-value { color: #666; }
.hasil-card.r3 .hc-score-value { color: #CD7F32; }

/* ===================== BOTTOM NAV ===================== */
.bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 60;
  height: var(--nav-h);
  display: flex;
  background: var(--putih-gading);
  border-top: 1px solid #e3d8c4;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.06);
  padding-bottom: env(safe-area-inset-bottom);
}
.nav-btn { flex: 1; border: none; background: none; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; color: var(--coklat); }
.nav-btn .nav-ico { font-size: 20px; }
.nav-btn .nav-lbl { font-size: 11px; font-weight: 600; }
.nav-btn.active { color: var(--hijau-tua); }
.nav-btn.active .nav-lbl { color: var(--emas); }
.nav-btn.active { border-top: 3px solid var(--emas); }

/* ===================== MODAL ===================== */
.modal-overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(20, 30, 25, 0.7);
  display: flex; align-items: center; justify-content: center; padding: 16px;
  animation: fade 0.2s ease;
}
.modal { background: var(--putih-gading); border-radius: 14px; width: 100%; max-width: 500px; max-height: 88vh; overflow-y: auto; box-shadow: 0 12px 40px rgba(0,0,0,0.3); }
.modal-head { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #e3d8c4; position: sticky; top: 0; background: var(--putih-gading); }
.modal-head h3 { color: var(--hijau-tua); font-size: 17px; }
.modal-close { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--coklat); }
.modal-body { padding: 16px; }

/* ===================== MODAL PIN ===================== */
.pin-modal { max-width: 320px; text-align: center; padding: 28px 24px; }
.pin-logo { font-size: 48px; margin-bottom: 6px; }
.pin-title { color: var(--hijau-tua); font-size: 20px; }
.pin-desc { font-size: 13px; color: var(--coklat); margin: 6px 0 18px; }
.pin-input {
  width: 100%; padding: 14px; text-align: center;
  font-size: 28px; letter-spacing: 12px; font-weight: 700;
  border: 2px solid #d8d0c0; border-radius: var(--radius); background: #fff;
}
.pin-input:focus { outline: none; border-color: var(--emas); }
.pin-error { color: var(--merah-error); font-size: 13px; font-weight: 600; min-height: 18px; margin: 8px 0; }
.pin-error.shake { animation: shake 0.4s; }
@keyframes shake { 0%,100%{transform:translateX(0);} 20%,60%{transform:translateX(-7px);} 40%,80%{transform:translateX(7px);} }
.pin-submit { margin-top: 4px; }
.pin-submit .mini-spinner { display: inline-block; width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.4); border-top-color: var(--emas-terang); border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; }

/* ===================== TOAST ===================== */
.toast {
  position: fixed; left: 50%; transform: translateX(-50%);
  bottom: calc(var(--nav-h) + 16px + env(safe-area-inset-bottom));
  z-index: 200; padding: 12px 18px; border-radius: var(--radius); color: #fff; font-size: 14px; font-weight: 600;
  max-width: 90%; box-shadow: 0 4px 16px rgba(0,0,0,0.25); animation: toastIn 0.25s ease;
}
.toast.success { background: var(--hijau-sedang); }
.toast.error { background: var(--merah-error); }
@keyframes toastIn { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }

/* ===================== LOADER ===================== */
.global-loader { position: fixed; inset: 0; z-index: 150; background: rgba(255,255,255,0.55); display: flex; align-items: center; justify-content: center; }
.spinner { width: 42px; height: 42px; border: 4px solid #e0d6c2; border-top-color: var(--hijau-tua); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ===================== SKELETON ===================== */
.skeleton { background: linear-gradient(90deg, #ece2d0 25%, #f5efe2 50%, #ece2d0 75%); background-size: 200% 100%; animation: shimmer 1.3s infinite; border-radius: 6px; height: 14px; margin: 6px 0; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ===================== RESPONSIVE ===================== */
@media (min-width: 768px) {
  .app-main { max-width: 960px; }
  .summary-cards { grid-template-columns: repeat(4, 1fr); }
  #hasilGroups .hasil-group { display: block; }
}
@media (min-width: 1024px) {
  .app-main { max-width: 1100px; }
}
@media (min-width: 1440px) {
  .app-main { max-width: 1600px; }
}


/* ===================== FOOTER ===================== */
.app-footer {
  text-align: center;
  padding: 24px 16px;
  padding-bottom: calc(24px + var(--nav-h) + env(safe-area-inset-bottom));
  background: var(--krem);
}
.footer-links {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.footer-links a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 22px;
  border: 1.5px solid #c8c0b4;
  border-radius: 50px;
  background: #fff;
  color: var(--hijau-tua);
  text-decoration: none;
  font-weight: 600;
  font-size: 14px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.footer-links a:hover {
  border-color: var(--hijau-sedang);
  box-shadow: 0 2px 8px rgba(27, 67, 50, 0.1);
}
.footer-links a i { font-size: 18px; }
.footer-copy {
  font-size: 13px;
  color: var(--coklat);
  margin: 0;
}

/* ===================== PIN INFO BOX ===================== */
.pin-info-box {
  background: #fff7e6;
  border: 1px solid var(--emas-terang);
  border-radius: var(--radius);
  padding: 12px 14px;
  margin-bottom: 16px;
  text-align: left;
  font-size: 12px;
  line-height: 1.6;
  color: var(--coklat);
}
.pin-info-box p { margin-bottom: 6px; }
.pin-wa-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 8px 14px;
  background: #25D366;
  color: #fff;
  border-radius: var(--radius);
  text-decoration: none;
  font-weight: 700;
  font-size: 13px;
}
.pin-wa-link:hover { filter: brightness(1.1); }


/* ===================== PIN MODAL CLOSE ===================== */
.pin-close {
  position: absolute;
  top: 12px;
  right: 14px;
  background: none;
  border: none;
  font-size: 20px;
  color: var(--coklat);
  cursor: pointer;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.pin-close:hover { background: #00000010; }
.pin-modal { position: relative; }


/* ===================== EDIT NILAI — TOTAL BOX ===================== */
.en-total-box {
  border: 3px solid var(--emas);
  border-radius: var(--radius);
  padding: 16px;
  text-align: center;
  margin: 16px 0;
  background: #fff;
}
.en-total-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--hijau-tua);
  letter-spacing: 1px;
  margin-bottom: 6px;
}
.en-total-value {
  font-size: 42px;
  font-weight: 800;
  font-family: 'Cinzel', serif;
  color: #999;
  line-height: 1;
}

/* Button row */
.en-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
.en-actions .btn-primary,
.en-actions .btn-secondary {
  flex: 1;
  margin-top: 0;
}
.en-actions .btn-secondary {
  background: #fff;
  color: var(--hijau-tua);
  border: 2px solid var(--hijau-tua);
  font-weight: 700;
}
.en-actions .btn-secondary:hover {
  background: var(--krem);
}


/* ===================== v3 — ROLE & PENILAIAN HEAD ===================== */
.penilaian-head-right { display: flex; align-items: center; gap: 8px; }
.role-badge {
  font-size: 11px; font-weight: 800; letter-spacing: 0.5px;
  padding: 4px 10px; border-radius: 20px; color: #fff;
}
.role-badge.role-admin { background: var(--emas); }
.role-badge.role-juri { background: var(--hijau-sedang); }

/* Subtabs wrap (bisa banyak tab) */
.subtabs { flex-wrap: wrap; }
.subtabs .subtab { flex: 1 1 40%; font-size: 13px; padding: 9px 8px; }

/* ===================== v3 — PESERTA AKTIF TAG ===================== */
.peserta-aktif-tag {
  display: inline-block;
  background: var(--hijau-tua);
  color: var(--emas-terang);
  font-size: 11px; font-weight: 800; letter-spacing: 0.5px;
  padding: 3px 10px; border-radius: 20px; margin-bottom: 8px;
}

/* ===================== v3 — GELANGGANG CARD ===================== */
.gel-card { padding: 14px; }
.gel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.gel-nama { font-family: 'Cinzel', serif; font-weight: 700; font-size: 16px; color: var(--hijau-tua); }
.gel-badge { font-size: 10px; font-weight: 800; letter-spacing: 0.5px; padding: 4px 9px; border-radius: 20px; color: #fff; }
.gel-badge-aktif { background: var(--hijau-sedang); }
.gel-badge-idle { background: #b0a896; }

.gel-aktif {
  background: linear-gradient(135deg, var(--hijau-tua), var(--hijau-sedang));
  color: var(--putih-gading);
  border-radius: var(--radius); padding: 12px 14px; margin-bottom: 10px;
}
.gel-aktif-label { font-size: 11px; font-weight: 800; color: var(--emas-terang); letter-spacing: 0.5px; }
.gel-aktif-nama { font-size: 17px; font-weight: 800; margin: 3px 0; }
.gel-aktif-meta { font-size: 12px; opacity: 0.9; margin-bottom: 10px; }
.gel-btn-selesai { width: 100%; margin: 0; padding: 10px; }
.gel-aktif-kosong { font-size: 13px; color: var(--coklat); font-style: italic; padding: 8px 0; }

.gel-antrian-title { font-size: 12px; font-weight: 700; color: var(--coklat); margin: 4px 0 6px; }
.gel-antrian-list { list-style: decimal; padding-left: 22px; margin-bottom: 10px; }
.gel-antrian-list li { padding: 6px 0; border-bottom: 1px dashed #e3d8c4; display: flex; align-items: center; gap: 8px; }
.gel-antrian-list .ga-order { display: flex; flex-direction: column; gap: 1px; }
.gel-antrian-list .ga-order .ga-move { font-size: 11px; line-height: 1; padding: 1px 4px; color: var(--hijau-sedang); }
.gel-antrian-list .ga-order .ga-move:disabled { color: #c9c0b0; cursor: default; }
.gel-antrian-list .ga-nama { flex: 1; font-weight: 600; color: var(--hijau-tua); font-size: 14px; }
.gel-antrian-list .ga-meta { font-size: 11px; color: var(--coklat); }
.gel-antrian-list .ga-actions { display: flex; gap: 2px; }
.gel-antrian-empty { font-size: 12px; color: var(--coklat); font-style: italic; margin-bottom: 10px; }
.gel-btn-tambah { margin-top: 0; }

/* ===================== v3 — GENERATE PIN ===================== */
.gp-result {
  margin-top: 14px; text-align: center;
  border: 3px solid var(--emas); border-radius: var(--radius);
  padding: 16px; background: #fff;
}
.gp-result-label { font-size: 12px; font-weight: 700; color: var(--hijau-tua); letter-spacing: 1px; margin-bottom: 6px; }
.gp-result-pin {
  font-size: 40px; font-weight: 800; font-family: 'Cinzel', serif;
  color: var(--hijau-tua); letter-spacing: 8px; line-height: 1; margin-bottom: 12px;
}
.pin-aktif { color: var(--hijau-sedang); font-weight: 700; }
.pin-nonaktif { color: var(--merah-error); font-weight: 700; }


/* ===================== v3 — REKAP INLINE EDIT ===================== */
.rk-jcell { padding: 4px !important; }
.rekap-jval {
  width: 54px; padding: 6px 4px; text-align: center;
  border: 1.5px solid #d8d0c0; border-radius: 6px; background: #fff;
  font-size: 13px; font-weight: 600; color: var(--hijau-tua);
  -moz-appearance: textfield;
}
.rekap-jval::-webkit-outer-spin-button,
.rekap-jval::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.rekap-jval:focus { outline: none; border-color: var(--emas); box-shadow: 0 0 0 2px rgba(212,168,67,0.25); }
.rekap-jval.saved { border-color: var(--hijau-sedang); background: #e9f7ee; }
.rekap-jval.error { border-color: var(--merah-error); background: #fdeeee; }
.rekap-jval:disabled { opacity: 0.6; }
.rk-nilaiakhir b { color: var(--hijau-tua); }


/* ===================== v3 — REKAP SPREADSHEET ===================== */
.rekap-hint { font-size: 12px; color: var(--coklat); margin-top: 10px; line-height: 1.5; background: #fff7e6; border: 1px solid var(--emas-terang); border-radius: var(--radius); padding: 8px 10px; }

.rekap-ss { font-size: 12px; }
.rekap-ss th, .rekap-ss td { text-align: center; }
.rekap-ss td:nth-child(2), .rekap-ss th:nth-child(2) { text-align: left; }   /* Nama */
.rekap-ss td:nth-child(7), .rekap-ss th:nth-child(7) { text-align: left; }   /* Nama Juri */

/* baris awal grup peserta diberi garis atas tegas */
.rekap-ss tbody tr.ss-group-start td { border-top: 2px solid var(--emas); }

/* sel kriteria & input */
.rekap-ss td.ss-cell { padding: 3px !important; }
.ss-val {
  width: 50px; padding: 5px 3px; text-align: center;
  border: 1.5px solid #d8d0c0; border-radius: 6px; background: #fff;
  font-size: 13px; font-weight: 600; color: var(--hijau-tua);
  -moz-appearance: textfield;
}
.ss-val::-webkit-outer-spin-button, .ss-val::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.ss-val:focus { outline: none; border-color: var(--emas); box-shadow: 0 0 0 2px rgba(212,168,67,0.3); }
.ss-val.invalid { border-color: var(--merah-error); background: #fdeeee; }
.ss-val.saved { border-color: var(--hijau-sedang); background: #e9f7ee; }
.ss-val.error { border-color: var(--merah-error); background: #fdeeee; }
.ss-val:disabled { opacity: 0.6; }

/* input Waktu / KG */
.ss-meta {
  padding: 5px 4px; text-align: center;
  border: 1.5px solid #d8d0c0; border-radius: 6px; background: #fff;
  font-size: 13px; font-weight: 600; color: var(--hijau-tua);
  -moz-appearance: textfield;
}
.ss-meta::-webkit-outer-spin-button, .ss-meta::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.ss-meta:focus { outline: none; border-color: var(--emas); box-shadow: 0 0 0 2px rgba(212,168,67,0.3); }
.ss-waktu { width: 58px; }
.ss-kg { width: 46px; }
.ss-meta.invalid { border-color: var(--merah-error); background: #fdeeee; }
.ss-meta.saved { border-color: var(--hijau-sedang); background: #e9f7ee; }
.ss-meta.error { border-color: var(--merah-error); background: #fdeeee; }
.ss-meta:disabled { opacity: 0.6; }

/* sel kriteria tak berlaku untuk kategori ini */
.rekap-ss td.ss-na { background: repeating-linear-gradient(45deg, #f1ebdd, #f1ebdd 4px, #ece4d2 4px, #ece4d2 8px); }

/* kolom hitungan otomatis (rowspan per peserta) */
.rekap-ss td.ss-rowtotal { background: #f3ead7; font-weight: 700; }
.rekap-ss td.ss-tertinggi, .rekap-ss td.ss-terendah,
.rekap-ss td.ss-orisinalitas, .rekap-ss td.ss-jml { background: #eef5ef; vertical-align: middle; font-weight: 600; }
.rekap-ss td.ss-nilaiakhir { background: var(--hijau-tua); color: var(--emas-terang); vertical-align: middle; font-size: 15px; }
.rekap-ss td.ss-nilaiakhir b { color: var(--emas-terang); }


/* ===================== PUSHER STATUS DOT ===================== */
.pusher-dot { font-size: 12px; cursor: help; line-height: 1; }
```

### `app.js`

```js
/* ==========================================================================
 * app.js — Pasanggiri Persinas ASAD (frontend logic)
 * --------------------------------------------------------------------------
 * PIN tidak ada di sini. Validasi PIN sepenuhnya server-side (Apps Script).
 * Frontend hanya mengirim PIN yang diketik user & menerima token sesi.
 * ========================================================================== */

(function () {
  'use strict';

  const C = window.CONFIG;

  /* ====================== STATE & CACHE ====================== */
  const state = {
    peserta: [],        // semua peserta
    nilai: [],          // semua penilaian
    kontingen: [],      // dari sheet Kontingen (dinamis)
    gelanggang: [],     // dari sheet Gelanggang (dinamis)
    pinList: [],        // daftar PIN Juri (admin)
    selectedPeserta: null,
    addAntrianGelanggang: null, // ID gelanggang target saat menambah antrian
    pesertaPageReady: false
  };

  /* ====================== UTIL DOM ====================== */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const el = (id) => document.getElementById(id);

  function showLoader(show) { el('globalLoader').classList.toggle('hidden', !show); }

  let toastTimer;
  function toast(msg, type = 'success') {
    const t = el('toast');
    t.textContent = msg;
    t.className = 'toast ' + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), 3000);
  }

  function openModal(id) { el(id).classList.remove('hidden'); }
  function closeModal(id) { el(id).classList.add('hidden'); }

  /* ====================== API LAYER ====================== */
  // GET: query params. POST: text/plain body (hindari CORS preflight di Apps Script).
  async function apiGet(action, params = {}) {
    const url = new URL(C.APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), { method: 'GET' });
    return res.json();
  }

  async function apiPost(action, payload = {}) {
    const res = await fetch(C.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload })
    });
    return res.json();
  }

  /* ====================== HELPERS DATA ====================== */
  const kodeKategori = (nama) => (C.KATEGORI.find(k => k.nama === nama) || {}).kode || '';
  const kodeGolongan = (nama) => (C.GOLONGAN.find(g => g.nama === nama) || {}).kode || '';
  const kodeKontingen = (nama) => (state.kontingen.find(k => k.nama === nama) || {}).kode || '';
  const getKategori = (nama) => C.KATEGORI.find(k => k.nama === nama);
  const kriteriaMeta = (key) => C.KRITERIA_PENILAIAN.find(k => k.key === key);

  // Golongan yang berlaku untuk sebuah kategori: golongan umum + golongan khusus kategori itu.
  function golonganListForKategori(kategoriNama) {
    const khusus = (C.GOLONGAN_KHUSUS && C.GOLONGAN_KHUSUS[kategoriNama]) || [];
    return C.GOLONGAN.concat(khusus);
  }

  // Semua golongan (umum + seluruh golongan khusus) — untuk dropdown filter & edit.
  function allGolonganList() {
    const extra = [];
    if (C.GOLONGAN_KHUSUS) {
      Object.keys(C.GOLONGAN_KHUSUS).forEach(kat => {
        (C.GOLONGAN_KHUSUS[kat] || []).forEach(g => {
          if (!C.GOLONGAN.some(x => x.nama === g.nama) && !extra.some(x => x.nama === g.nama)) extra.push(g);
        });
      });
    }
    return C.GOLONGAN.concat(extra);
  }

  // Rentang jumlah peserta efektif berdasarkan kategori + golongan (override min utk golongan khusus).
  function effectiveRange(kategoriNama, golonganNama) {
    const kat = getKategori(kategoriNama);
    if (!kat) return { min: 1, max: 1 };
    let min = kat.min, max = kat.max;
    const ov = C.GOLONGAN_MIN_PESERTA && C.GOLONGAN_MIN_PESERTA[golonganNama];
    if (ov != null) min = Math.max(min, ov);
    if (min > max) max = min;
    return { min, max };
  }

  function orisinalitasRange(kategoriNama) {
    return C.ORISINALITAS_RANGE[kategoriNama] || C.ORISINALITAS_RANGE.DEFAULT;
  }

  function rangeFor(kategoriNama, key) {
    if (key === 'orisinalitas') return orisinalitasRange(kategoriNama);
    const m = kriteriaMeta(key);
    return { min: m.min, max: m.max };
  }

  function fillSelect(sel, items, { valueKey = 'nama', labelKey = 'nama', placeholder = null, all = false } = {}) {
    sel.innerHTML = '';
    if (placeholder) sel.appendChild(new Option(placeholder, ''));
    if (all) sel.appendChild(new Option('Semua', ''));
    items.forEach(it => {
      const v = typeof it === 'string' ? it : it[valueKey];
      const l = typeof it === 'string' ? it : it[labelKey];
      sel.appendChild(new Option(l, v));
    });
  }

  const pad3 = (n) => String(n).padStart(3, '0');
  const detikToMMSS = (d) => {
    d = parseInt(d, 10) || 0;
    return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`;
  };

  /* ====================================================================== *
   * NAVIGASI
   * ====================================================================== */
  function gotoPage(pageId) {
    $$('.page').forEach(p => p.classList.toggle('active', p.id === pageId));
    $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === pageId));

    if (pageId === 'page-dashboard') loadDashboard();
    if (pageId === 'page-penilaian') enterPenilaian();
    if (pageId === 'page-hasil') loadHasil();
  }

  function initNav() {
    $$('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => gotoPage(btn.dataset.page));
    });
  }

  /* ====================================================================== *
   * HALAMAN 1 — PENDAFTARAN
   * ====================================================================== */
  let pesertaSlots = 1;

  function initForm() {
    fillSelect(el('f-kategori'), C.KATEGORI, { placeholder: 'Pilih kategori' });
    fillSelect(el('f-golongan'), C.GOLONGAN, { placeholder: 'Pilih golongan' });
    fillSelect(el('f-kontingen'), state.kontingen, { placeholder: 'Pilih kontingen' });

    el('f-kategori').addEventListener('change', onKategoriChange);
    el('f-golongan').addEventListener('change', onGolonganChange);
    el('btnTambahPeserta').addEventListener('click', () => changePesertaSlots(1));
    el('btnKurangPeserta').addEventListener('click', () => changePesertaSlots(-1));

    el('btnTogglePeraturan').addEventListener('click', togglePeraturan);
    el('formPendaftaran').addEventListener('submit', submitPendaftaran);
  }

  // Isi dropdown golongan sesuai kategori (tambahkan golongan khusus bila ada).
  function populateGolonganForKategori(kategoriNama) {
    const list = kategoriNama ? golonganListForKategori(kategoriNama) : C.GOLONGAN;
    const prev = el('f-golongan').value;
    fillSelect(el('f-golongan'), list, { placeholder: 'Pilih golongan' });
    if (prev && list.some(g => g.nama === prev)) el('f-golongan').value = prev;
  }

  function onKategoriChange() {
    const kat = getKategori(el('f-kategori').value);
    populateGolonganForKategori(el('f-kategori').value);
    if (!kat) { el('pesertaInputs').innerHTML = ''; el('pesertaControls').classList.add('hidden'); el('pesertaCount').textContent = ''; return; }
    updatePesertaSlots();
  }

  function onGolonganChange() {
    if (getKategori(el('f-kategori').value)) updatePesertaSlots();
  }

  // Set jumlah slot peserta ke minimal efektif & render input.
  function updatePesertaSlots() {
    const r = effectiveRange(el('f-kategori').value, el('f-golongan').value);
    pesertaSlots = r.min;
    renderPesertaInputs();
    el('pesertaControls').classList.toggle('hidden', r.min === r.max);
  }

  function renderPesertaInputs() {
    const kat = getKategori(el('f-kategori').value);
    const r = effectiveRange(el('f-kategori').value, el('f-golongan').value);
    const wrap = el('pesertaInputs');
    const existing = $$('input', wrap).map(i => i.value);
    wrap.innerHTML = '';
    for (let i = 0; i < pesertaSlots; i++) {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.placeholder = `Nama peserta ${i + 1}`;
      inp.className = 'peserta-name';
      if (existing[i]) inp.value = existing[i];
      wrap.appendChild(inp);
    }
    el('pesertaCount').textContent = kat ? `(${pesertaSlots} dari ${r.min}–${r.max})` : '';
  }

  function changePesertaSlots(delta) {
    const kat = getKategori(el('f-kategori').value);
    if (!kat) return;
    const r = effectiveRange(el('f-kategori').value, el('f-golongan').value);
    const next = pesertaSlots + delta;
    if (next < r.min || next > r.max) return;
    pesertaSlots = next;
    renderPesertaInputs();
  }

  function togglePeraturan() {
    const wrap = el('peraturanWrap');
    const frame = el('peraturanFrame');
    const willShow = wrap.classList.contains('hidden');
    if (willShow && !frame.src) frame.src = 'peraturan-pasanggiri.pdf';
    wrap.classList.toggle('hidden');
  }

  async function submitPendaftaran(e) {
    e.preventDefault();
    const kategori = el('f-kategori').value;
    const golongan = el('f-golongan').value;
    const kontingen = el('f-kontingen').value;
    const namaPeserta = $$('.peserta-name', el('pesertaInputs')).map(i => i.value.trim()).filter(Boolean);
    const kat = getKategori(kategori);

    if (!kategori || !golongan || !kontingen) return toast('Lengkapi kategori, golongan, kontingen.', 'error');
    const r = effectiveRange(kategori, golongan);
    if (namaPeserta.length < r.min) return toast(`Minimal ${r.min} nama peserta untuk ${kategori}${golongan === 'Campuran' ? ' (Campuran)' : ''}.`, 'error');

    const btn = el('btnSubmitDaftar');
    btn.disabled = true; showLoader(true);
    try {
      const resp = await apiPost('add', {
        kategori, golongan, kontingen,
        namaPeserta: namaPeserta.join(', ')
      });
      if (resp.success) {
        toast(`Terdaftar! No. Urut: ${resp.nomorUrut}`);
        el('formPendaftaran').reset();
        onKategoriChange();
        state.peserta = []; // invalidate cache
      } else {
        toast(resp.message || 'Gagal mendaftar.', 'error');
      }
    } catch (err) {
      toast('Koneksi gagal. Periksa URL Apps Script.', 'error');
    } finally {
      btn.disabled = false; showLoader(false);
    }
  }

  /* ====================================================================== *
   * HALAMAN 2 — DASHBOARD
   * ====================================================================== */
  function initDashboard() {
    fillSelect(el('d-filter-kategori'), C.KATEGORI, { all: true });
    fillSelect(el('d-filter-golongan'), allGolonganList(), { all: true });
    fillSelect(el('d-filter-kontingen'), state.kontingen, { all: true });
    ['d-filter-kategori', 'd-filter-golongan', 'd-filter-kontingen'].forEach(id =>
      el(id).addEventListener('change', renderDashboard));
    el('btnRefreshDashboard').addEventListener('click', () => loadDashboard(true));
  }

  async function fetchPeserta(force = false) {
    if (state.peserta.length && !force) return state.peserta;
    const resp = await apiGet('getAll');
    state.peserta = (resp.data || resp || []);
    return state.peserta;
  }

  async function loadDashboard(force = false) {
    showLoader(true);
    try {
      await fetchPeserta(force);
      renderDashboard();
    } catch (e) {
      toast('Gagal memuat data peserta.', 'error');
    } finally { showLoader(false); }
  }

  function filteredPeserta() {
    const fk = el('d-filter-kategori').value;
    const fg = el('d-filter-golongan').value;
    const fc = el('d-filter-kontingen').value;
    return state.peserta.filter(p =>
      (!fk || p.kategori === fk) &&
      (!fg || p.golongan === fg) &&
      (!fc || p.kontingen === fc));
  }

  function renderDashboard() {
    const list = filteredPeserta();
    // summary
    const sc = el('summaryCards');
    const perKat = C.KATEGORI.map(k => ({ nama: k.nama, n: list.filter(p => p.kategori === k.nama).length }));
    sc.innerHTML = `<div class="summary-card"><div class="num">${list.length}</div><div class="lbl">Total Peserta</div></div>` +
      perKat.map(k => `<div class="summary-card"><div class="num">${k.n}</div><div class="lbl">${k.nama}</div></div>`).join('');

    // table
    const body = el('tablePesertaBody');
    el('dashboardEmpty').classList.toggle('hidden', list.length > 0);
    body.innerHTML = list.map(p => `
      <tr>
        <td>${p.nomorUrut}</td>
        <td>${p.kategori}</td>
        <td>${p.golongan}</td>
        <td>${escapeHtml(p.namaPeserta)}</td>
        <td>
          <button class="btn-icon" data-edit="${p.nomorUrut}">✏️</button>
          <button class="btn-icon" data-del="${p.nomorUrut}">🗑️</button>
        </td>
      </tr>`).join('');

    $$('[data-edit]', body).forEach(b => b.addEventListener('click', () => openEditPeserta(b.dataset.edit)));
    $$('[data-del]', body).forEach(b => b.addEventListener('click', () => deletePeserta(b.dataset.del)));
  }

  function openEditPeserta(nomorUrut) {
    const p = state.peserta.find(x => String(x.nomorUrut) === String(nomorUrut));
    if (!p) return;
    el('editPesertaTitle').textContent = `Edit ${p.nomorUrut}`;
    el('editPesertaBody').innerHTML = `
      <div class="field"><label>Kategori</label><select id="e-kategori"></select></div>
      <div class="field"><label>Golongan</label><select id="e-golongan"></select></div>
      <div class="field"><label>Kontingen</label><select id="e-kontingen"></select></div>
      <div class="field"><label>Nama Peserta (pisahkan dengan koma)</label><input id="e-peserta" value="${escapeAttr(p.namaPeserta)}" /></div>
      <button class="btn-primary" id="e-save">Simpan Perubahan</button>`;
    fillSelect(el('e-kategori'), C.KATEGORI);
    fillSelect(el('e-golongan'), golonganListForKategori(p.kategori));
    fillSelect(el('e-kontingen'), state.kontingen);
    el('e-kategori').value = p.kategori;
    el('e-golongan').value = p.golongan;
    el('e-kontingen').value = p.kontingen;
    // Saat kategori diganti, sesuaikan opsi golongan (mis. Campuran hanya untuk MASSAL).
    el('e-kategori').addEventListener('change', () => {
      const cur = el('e-golongan').value;
      const list = golonganListForKategori(el('e-kategori').value);
      fillSelect(el('e-golongan'), list);
      if (list.some(g => g.nama === cur)) el('e-golongan').value = cur;
    });
    el('e-save').addEventListener('click', () => saveEditPeserta(nomorUrut));
    openModal('editPesertaModal');
  }

  async function saveEditPeserta(nomorUrut) {
    const payload = {
      nomorUrut,
      kategori: el('e-kategori').value,
      golongan: el('e-golongan').value,
      kontingen: el('e-kontingen').value,
      namaPeserta: el('e-peserta').value.trim()
    };
    showLoader(true);
    try {
      const resp = await apiPost('update', payload);
      if (resp.success) {
        toast('Peserta diperbarui.');
        closeModal('editPesertaModal');
        await loadDashboard(true);
      } else toast(resp.message || 'Gagal memperbarui.', 'error');
    } catch (e) { toast('Koneksi gagal.', 'error'); }
    finally { showLoader(false); }
  }

  async function deletePeserta(nomorUrut) {
    if (!confirm(`Hapus peserta ${nomorUrut}? Tindakan ini tidak bisa dibatalkan.`)) return;
    showLoader(true);
    try {
      const resp = await apiPost('delete', { nomorUrut });
      if (resp.success) { toast('Peserta dihapus.'); await loadDashboard(true); }
      else toast(resp.message || 'Gagal menghapus.', 'error');
    } catch (e) { toast('Koneksi gagal.', 'error'); }
    finally { showLoader(false); }
  }

  /* ====================================================================== *
   * HALAMAN 3 — PENILAIAN (akses PIN server-side)
   * ====================================================================== */
  const TOKEN_KEY = 'juriToken';
  const TOKEN_EXP_KEY = 'juriTokenExpiry';
  const ROLE_KEY = 'juriRole';
  const FAIL_KEY = 'pinFailCount';
  const COOLDOWN_KEY = 'pinCooldownUntil';
  let cooldownTimer = null;

  function hasValidToken() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const exp = sessionStorage.getItem(TOKEN_EXP_KEY);
    if (!token || !exp) return false;
    return new Date(exp).getTime() > Date.now();
  }

  function currentRole() {
    return (sessionStorage.getItem(ROLE_KEY) || 'JURI').toUpperCase();
  }
  function isAdmin() { return currentRole() === 'ADMIN'; }

  function initPenilaian() {
    el('btnBukaPin').addEventListener('click', showPinModal);
    el('btnKunci').addEventListener('click', lockPenilaian);
    el('pinForm').addEventListener('submit', submitPin);
    el('pinCloseBtn').addEventListener('click', () => closeModal('pinModal'));

    // subtabs
    $$('.subtab').forEach(tab => tab.addEventListener('click', () => {
      $$('.subtab').forEach(t => t.classList.toggle('active', t === tab));
      $$('.subtab-panel').forEach(p => p.classList.toggle('active', p.id === `subtab-${tab.dataset.subtab}`));
      if (tab.dataset.subtab === 'rekap') loadRekap();
      if (tab.dataset.subtab === 'antrian') loadGelanggangAdmin();
      if (tab.dataset.subtab === 'pin') loadPinList();
    }));

    // form penilaian widgets (berbasis gelanggang)
    el('fn-gelanggang').addEventListener('change', loadPesertaAktif);
    el('btnRefreshAktif').addEventListener('click', () => loadPesertaAktif());
    el('pilihJuri').addEventListener('change', onPilihJuri);
    el('waktuMenit').addEventListener('input', recalcTotal);
    el('waktuDetik').addEventListener('input', recalcTotal);
    el('keluarGelanggang').addEventListener('input', recalcTotal);
    el('btnSimpanNilai').addEventListener('click', simpanNilai);

    fillSelect(el('pilihJuri'), C.JURI_LIST, { placeholder: 'Pilih juri' });

    // rekap filters
    fillSelect(el('r-filter-golongan'), allGolonganList(), { all: true });
    fillSelect(el('r-filter-kategori'), C.KATEGORI, { all: true });
    el('r-filter-golongan').addEventListener('change', renderRekap);
    el('r-filter-kategori').addEventListener('change', renderRekap);
    el('btnRefreshRekap').addEventListener('click', () => loadRekap(true));

    // admin: gelanggang & antrian
    el('btnTambahGelanggang').addEventListener('click', tambahGelanggang);
    el('aa-cari').addEventListener('input', onCariAntrian);

    // admin: generate PIN
    el('btnGeneratePin').addEventListener('click', generatePin);
    el('btnCopyPin').addEventListener('click', copyGeneratedPin);
    el('btnRefreshPin').addEventListener('click', () => loadPinList());
  }

  // Tampilkan/sembunyikan subtab sesuai role & render badge.
  function applyRoleUI() {
    const admin = isAdmin();
    el('roleBadge').textContent = admin ? 'ADMIN' : 'JURI';
    el('roleBadge').className = 'role-badge ' + (admin ? 'role-admin' : 'role-juri');
    $$('.subtab').forEach(tab => {
      const adminOnly = tab.dataset.role === 'ADMIN';
      tab.classList.toggle('hidden', adminOnly && !admin);
    });
    // Jika tab aktif tersembunyi (mis. setelah logout admin), kembali ke Form Nilai
    const activeTab = $('.subtab.active');
    if (!activeTab || activeTab.classList.contains('hidden')) {
      $$('.subtab').forEach(t => t.classList.toggle('active', t.dataset.subtab === 'form'));
      $$('.subtab-panel').forEach(p => p.classList.toggle('active', p.id === 'subtab-form'));
    }
  }

  function enterPenilaian() {
    if (hasValidToken()) {
      el('penilaianLocked').classList.add('hidden');
      el('penilaianContent').classList.remove('hidden');
      applyRoleUI();
      fetchPeserta();      // warm cache
      loadGelanggangOptions(); // isi dropdown gelanggang Form Nilai
    } else {
      el('penilaianContent').classList.add('hidden');
      el('penilaianLocked').classList.remove('hidden');
      showPinModal();
    }
  }

  function lockPenilaian() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXP_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    el('penilaianContent').classList.add('hidden');
    el('penilaianLocked').classList.remove('hidden');
    showPinModal();
    toast('Halaman penilaian dikunci.');
  }

  function showPinModal() {
    el('pinInput').value = '';
    el('pinError').textContent = '';
    openModal('pinModal');
    refreshCooldownUI();
    setTimeout(() => el('pinInput').focus(), 50);
  }

  function getCooldownRemaining() {
    const until = parseInt(sessionStorage.getItem(COOLDOWN_KEY) || '0', 10);
    return Math.max(0, until - Date.now());
  }

  function refreshCooldownUI() {
    clearInterval(cooldownTimer);
    const btn = el('pinSubmitBtn');
    const tick = () => {
      const rem = getCooldownRemaining();
      if (rem > 0) {
        btn.disabled = true;
        btn.textContent = `Tunggu ${Math.ceil(rem / 1000)} detik...`;
      } else {
        clearInterval(cooldownTimer);
        btn.disabled = false;
        btn.textContent = 'Masuk';
      }
    };
    tick();
    if (getCooldownRemaining() > 0) cooldownTimer = setInterval(tick, 500);
  }

  function pinErrorShake(msg) {
    const e = el('pinError');
    e.textContent = msg;
    e.classList.remove('shake');
    void e.offsetWidth; // reflow to restart animation
    e.classList.add('shake');
  }

  async function submitPin(e) {
    e.preventDefault();
    if (getCooldownRemaining() > 0) return;
    const pin = el('pinInput').value.trim();
    if (pin.length < 4) return pinErrorShake('PIN minimal 4 digit.');

    const btn = el('pinSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="mini-spinner"></span>';
    try {
      const resp = await apiPost('validatePin', { pin });
      if (resp && resp.success) {
        sessionStorage.setItem(TOKEN_KEY, resp.token);
        sessionStorage.setItem(TOKEN_EXP_KEY, resp.expiredAt);
        sessionStorage.setItem(ROLE_KEY, (resp.role || 'JURI').toUpperCase());
        sessionStorage.removeItem(FAIL_KEY);
        sessionStorage.removeItem(COOLDOWN_KEY);
        closeModal('pinModal');
        btn.textContent = 'Masuk';
        enterPenilaian();
        toast(`Akses ${(resp.role || 'JURI').toUpperCase()} diberikan.`);
      } else {
        registerPinFail(resp && resp.message);
      }
    } catch (err) {
      pinErrorShake('Koneksi gagal. Coba lagi.');
    } finally {
      if (!btn.textContent || btn.querySelector('.mini-spinner')) btn.textContent = 'Masuk';
      refreshCooldownUI();
    }
  }

  function registerPinFail(message) {
    let fails = parseInt(sessionStorage.getItem(FAIL_KEY) || '0', 10) + 1;
    sessionStorage.setItem(FAIL_KEY, String(fails));
    el('pinInput').value = '';
    el('pinInput').focus();
    if (fails >= 3) {
      sessionStorage.setItem(COOLDOWN_KEY, String(Date.now() + 30000));
      sessionStorage.setItem(FAIL_KEY, '0');
      pinErrorShake('Terlalu banyak percobaan. Tunggu 30 detik.');
    } else {
      pinErrorShake(message || `PIN salah. Sisa percobaan: ${3 - fails}.`);
    }
  }

  /* -------------------- FORM NILAI: berbasis gelanggang -------------------- */
  async function loadGelanggangOptions() {
    try {
      const resp = await apiGet('getGelanggang');
      state.gelanggang = resp.data || resp || [];
    } catch (e) { state.gelanggang = []; }
    const sel = el('fn-gelanggang');
    const prev = sel.value;
    sel.innerHTML = '<option value="">Pilih gelanggang…</option>';
    state.gelanggang.forEach(g => sel.appendChild(new Option(g.nama, g.id)));
    if (prev) sel.value = prev;
  }

  async function loadPesertaAktif() {
    const idGel = el('fn-gelanggang').value;
    // reset tampilan
    state.selectedPeserta = null;
    el('pesertaTerpilih').classList.add('hidden');
    el('pesertaAktifKosong').classList.add('hidden');
    el('step2').classList.add('hidden');
    el('step3').classList.add('hidden');
    if (!idGel) return;

    showLoader(true);
    try {
      await fetchPeserta();
      const resp = await apiGet('getPesertaAktif', { id: idGel });
      const aktif = resp.data || resp || null;
      if (!aktif || !aktif.nomorUrut) {
        el('pesertaAktifKosong').classList.remove('hidden');
        return;
      }
      // Lengkapi data peserta dari cache jika perlu
      const p = state.peserta.find(x => String(x.nomorUrut) === String(aktif.nomorUrut)) || aktif;
      showPesertaForScoring({
        nomorUrut: aktif.nomorUrut,
        kategori: aktif.kategori || p.kategori,
        golongan: aktif.golongan || p.golongan,
        kontingen: aktif.kontingen || p.kontingen,
        namaPeserta: aktif.namaPeserta || p.namaPeserta
      });
    } catch (e) {
      toast('Gagal memuat peserta aktif.', 'error');
    } finally { showLoader(false); }
  }

  // Siapkan form penilaian untuk peserta tertentu (read-only data peserta).
  function showPesertaForScoring(p) {
    state.selectedPeserta = p;

    const info = el('pesertaTerpilih');
    info.classList.remove('hidden');
    info.innerHTML = `
      <div class="peserta-aktif-tag">▶ SEDANG TAMPIL</div>
      <div><b>No. Urut:</b> ${p.nomorUrut}</div>
      <div><b>Kategori:</b> ${p.kategori}</div>
      <div><b>Golongan:</b> ${p.golongan}</div>
      <div><b>Kontingen:</b> ${p.kontingen}</div>
      <div><b>Peserta:</b> ${escapeHtml(p.namaPeserta)}</div>`;

    el('step2').classList.remove('hidden');
    el('step3').classList.remove('hidden');
    renderJuriBadges();
    renderKriteriaInputs();
    setupKeluarGelanggangField();
    el('pilihJuri').value = '';
    el('namaJuri').value = '';
    recalcTotal();
  }

  async function renderJuriBadges() {
    const p = state.selectedPeserta;
    const badges = el('juriBadges');
    badges.innerHTML = C.JURI_LIST.map(j => `<span class="juri-badge" data-juri="${escapeAttr(j)}">${j}</span>`).join('');
    try {
      const resp = await apiGet('getNilaiByPeserta', { nomorUrut: p.nomorUrut });
      const nilaiList = resp.data || resp || [];
      p._sudahDinilai = nilaiList.map(n => n.juri);
      $$('.juri-badge', badges).forEach(b => {
        if (p._sudahDinilai.includes(b.dataset.juri)) b.classList.add('done');
      });
    } catch (e) { /* abaikan */ }
  }

  function onPilihJuri() {
    const juri = el('pilihJuri').value;
    const p = state.selectedPeserta;
    if (juri && p && p._sudahDinilai && p._sudahDinilai.includes(juri)) {
      toast(`${juri} sudah menilai peserta ini.`, 'error');
    }
  }

  function renderKriteriaInputs() {
    const p = state.selectedPeserta;
    const keys = C.KRITERIA_PER_KATEGORI[p.kategori] || [];
    const wrap = el('kriteriaInputs');
    wrap.innerHTML = keys.map(key => {
      const meta = kriteriaMeta(key);
      const r = rangeFor(p.kategori, key);
      return `
        <div class="kriteria-item field" data-key="${key}">
          <label>${meta.nama}<span class="range-hint">${r.min}–${r.max}</span></label>
          <input type="number" class="kriteria-val" data-key="${key}" min="${r.min}" max="${r.max}" inputmode="numeric" />
        </div>`;
    }).join('');
    $$('.kriteria-val', wrap).forEach(inp => {
      inp.addEventListener('input', () => { validateKriteriaInput(inp); recalcTotal(); });
    });
  }

  function validateKriteriaInput(inp) {
    const r = { min: parseFloat(inp.min), max: parseFloat(inp.max) };
    const v = parseFloat(inp.value);
    const bad = inp.value !== '' && (isNaN(v) || v < r.min || v > r.max);
    inp.classList.toggle('invalid', bad);
    return !bad;
  }

  function setupKeluarGelanggangField() {
    const isBPS = state.selectedPeserta.kategori === 'BERPASANGAN';
    el('keluarGelanggangField').classList.toggle('hidden', !isBPS);
    el('keluarGelanggang').value = 0;
    el('keluarNotif').textContent = '';
  }

  function getWaktuDetik() {
    const m = parseInt(el('waktuMenit').value, 10) || 0;
    const s = parseInt(el('waktuDetik').value, 10) || 0;
    return m * 60 + s;
  }

  // Hitung total + penalti. Mengembalikan { base, penalti, total }
  function computeScore() {
    const p = state.selectedPeserta;
    if (!p) return { base: 0, penalti: 0, total: 0 };
    const kategori = p.kategori;
    const waktu = getWaktuDetik();

    // Aturan KEMANTAPAN auto utk non-BERPASANGAN bila waktu > batas
    // ATT: batas 5:00 (300 detik), lainnya: batas 3:10 (190 detik)
    const kemantapanInput = $('.kriteria-val[data-key="kemantapan"]', el('kriteriaInputs'));
    if (kategori !== 'BERPASANGAN' && kemantapanInput) {
      const batasWaktu = kategori === 'ATT' ? C.WAKTU_TAMPIL_BATAS_ATT : C.WAKTU_TAMPIL_BATAS_DETIK;
      if (waktu > batasWaktu) {
        kemantapanInput.value = C.KEMANTAPAN_DEFAULT_LEBIH_WAKTU;
        kemantapanInput.readOnly = true;
        validateKriteriaInput(kemantapanInput);
      } else {
        kemantapanInput.readOnly = false;
      }
    }

    let base = 0;
    $$('.kriteria-val', el('kriteriaInputs')).forEach(inp => { base += parseFloat(inp.value) || 0; });

    let penalti = 0;
    if (kategori === 'BERPASANGAN') {
      // penalti waktu (hanya jika LEBIH dari 2:00)
      if (waktu > C.BERPASANGAN_WAKTU.IDEAL_DETIK) {
        const selisih = waktu - C.BERPASANGAN_WAKTU.IDEAL_DETIK;
        const rule = C.BERPASANGAN_WAKTU.PENALTI.find(r => selisih >= r.minSelisih && selisih <= r.maxSelisih);
        if (rule) penalti += rule.potong;
      }
      // penalti keluar gelanggang
      const keluar = parseInt(el('keluarGelanggang').value, 10) || 0;
      penalti += keluar * C.BERPASANGAN_KELUAR_GELANGGANG_POIN;
    }

    return { base, penalti, total: base - penalti };
  }

  function recalcTotal() {
    const p = state.selectedPeserta;
    if (!p) return;
    const { base, penalti, total } = computeScore();

    // notif waktu
    const waktu = getWaktuDetik();
    const wNotif = el('waktuNotif');
    if (p.kategori === 'BERPASANGAN') {
      if (waktu > C.BERPASANGAN_WAKTU.IDEAL_DETIK) {
        const selisih = waktu - C.BERPASANGAN_WAKTU.IDEAL_DETIK;
        const rule = C.BERPASANGAN_WAKTU.PENALTI.find(r => selisih >= r.minSelisih && selisih <= r.maxSelisih);
        if (rule) { wNotif.textContent = `Lebih ${selisih} detik dari 2:00 → −${rule.potong} poin`; wNotif.className = 'notif-inline'; }
        else { wNotif.textContent = 'Waktu dalam toleransi (tanpa penalti).'; wNotif.className = 'notif-inline ok'; }
      } else { wNotif.textContent = ''; }
      // keluar gelanggang notif
      const keluar = parseInt(el('keluarGelanggang').value, 10) || 0;
      el('keluarNotif').textContent = keluar > 0 ? `${keluar}× keluar → −${keluar * C.BERPASANGAN_KELUAR_GELANGGANG_POIN} poin` : '';
    } else {
      const batasWaktu = p.kategori === 'ATT' ? C.WAKTU_TAMPIL_BATAS_ATT : C.WAKTU_TAMPIL_BATAS_DETIK;
      if (waktu > batasWaktu) { wNotif.textContent = `Waktu > ${detikToMMSS(batasWaktu)} → KEMANTAPAN otomatis ${C.KEMANTAPAN_DEFAULT_LEBIH_WAKTU}.`; wNotif.className = 'notif-inline'; }
      else { wNotif.textContent = ''; }
    }

    // tampilkan total + warna
    const tv = el('totalNilai');
    tv.className = 'total-value';
    if (total >= C.TOTAL_WARNA.HIGH) tv.classList.add('total-high');
    else if (total >= C.TOTAL_WARNA.MID) tv.classList.add('total-mid');
    tv.innerHTML = penalti > 0 ? `${total} <span class="penalti">(−${penalti})</span>` : `${total}`;
  }

  async function simpanNilai() {
    const p = state.selectedPeserta;
    if (!p) return toast('Pilih peserta dahulu.', 'error');
    const juri = el('pilihJuri').value;
    const namaJuri = el('namaJuri').value.trim();
    if (!juri) return toast('Pilih juri.', 'error');
    if (!namaJuri) return toast('Nama juri wajib diisi.', 'error');
    if (p._sudahDinilai && p._sudahDinilai.includes(juri)) return toast(`${juri} sudah menilai peserta ini.`, 'error');

    // validasi kriteria
    const inputs = $$('.kriteria-val', el('kriteriaInputs'));
    let valid = true;
    const nilaiObj = {};
    inputs.forEach(inp => {
      if (!validateKriteriaInput(inp) || inp.value === '') valid = false;
      nilaiObj[inp.dataset.key] = parseFloat(inp.value) || 0;
    });
    if (!valid) return toast('Periksa nilai kriteria (di luar range / kosong).', 'error');

    const waktu = getWaktuDetik();
    if (waktu <= 0) return toast('Isi waktu tampil.', 'error');

    const { total } = computeScore();
    const keluar = p.kategori === 'BERPASANGAN' ? (parseInt(el('keluarGelanggang').value, 10) || 0) : 0;

    const payload = {
      nomorUrut: p.nomorUrut,
      kategori: p.kategori,
      golongan: p.golongan,
      kontingen: p.kontingen,
      namaPeserta: p.namaPeserta,
      juri, namaJuri,
      waktu, keluarGelanggang: keluar,
      nilai: nilaiObj,
      totalNilai: total
    };

    showLoader(true);
    el('btnSimpanNilai').disabled = true;
    try {
      const resp = await apiPost('addNilai', payload);
      if (resp.success) {
        toast('Penilaian tersimpan.');
        pushEvent('nilai-submitted', { nomorUrut: p.nomorUrut, juri });
        resetFormPenilaian();
      } else toast(resp.message || 'Gagal menyimpan nilai.', 'error');
    } catch (e) { toast('Koneksi gagal.', 'error'); }
    finally { showLoader(false); el('btnSimpanNilai').disabled = false; }
  }

  function resetFormPenilaian() {
    state.selectedPeserta = null;
    el('pesertaTerpilih').classList.add('hidden');
    el('step2').classList.add('hidden');
    el('step3').classList.add('hidden');
    el('waktuMenit').value = '';
    el('waktuDetik').value = '';
    // Muat ulang peserta aktif (mungkin sudah berganti oleh Admin)
    loadPesertaAktif();
  }

  /* -------------------- REKAP NILAI (tampilan spreadsheet) -------------------- */
  // Urutan & label singkat kolom kriteria — sama dengan sheet Penilaian.
  const SS_KEYS = ['orisinalitas', 'kemantapan', 'stamina', 'kekompakan',
    'kreatifitas', 'kekayaanTeknik', 'teknikSerangBela', 'penghayatan'];
  const SS_SHORT = {
    orisinalitas: 'ORI', kemantapan: 'KMT', stamina: 'STM', kekompakan: 'KKP',
    kreatifitas: 'KRF', kekayaanTeknik: 'KKT', teknikSerangBela: 'TSB', penghayatan: 'PGH'
  };

  async function loadRekap(force = false) {
    showLoader(true);
    try {
      const resp = await apiGet('getAllNilai');
      // salin tiap baris agar bisa diedit lokal tanpa mengubah cache asli
      state.nilaiRows = (resp.data || resp || []).map(r => Object.assign({}, r));
      renderRekap();
    } catch (e) { toast('Gagal memuat rekap.', 'error'); }
    finally { showLoader(false); }
  }

  const juriNum = (juri) => { const m = String(juri).match(/(\d+)/); return m ? parseInt(m[1], 10) : 99; };

  // Total satu baris penilaian: jumlah kriteria aktif − penalti (khusus BERPASANGAN).
  function computeRowTotal(row) {
    const keys = C.KRITERIA_PER_KATEGORI[row.kategori] || [];
    let base = 0;
    keys.forEach(k => { base += Number(row[k]) || 0; });
    let penalti = 0;
    if (row.kategori === 'BERPASANGAN') {
      const w = Number(row.waktu) || 0;
      if (w > C.BERPASANGAN_WAKTU.IDEAL_DETIK) {
        const selisih = w - C.BERPASANGAN_WAKTU.IDEAL_DETIK;
        const rule = C.BERPASANGAN_WAKTU.PENALTI.find(r => selisih >= r.minSelisih && selisih <= r.maxSelisih);
        if (rule) penalti += rule.potong;
      }
      penalti += (Number(row.keluarGelanggang) || 0) * C.BERPASANGAN_KELUAR_GELANGGANG_POIN;
    }
    return base - penalti;
  }

  // Hitung agregat per peserta (Tertinggi/Terendah/Orisinalitas/Nilai Akhir/Jumlah Juri).
  function computeGroup(rows) {
    const totals = rows.map(r => Number(r.totalNilai) || 0);
    const oris = rows.map(r => Number(r.orisinalitas) || 0);
    const jumlah = rows.length;
    if (!jumlah) return { tertinggi: null, terendah: null, orisinalitas: null, nilaiAkhir: null, jumlahJuri: 0 };
    const sum = totals.reduce((a, b) => a + b, 0);
    const max = Math.max.apply(null, totals);
    const min = Math.min.apply(null, totals);
    const nilaiAkhir = jumlah >= 3 ? (sum - max - min) : sum;
    let orisinalitas;
    if (jumlah < 3) {
      orisinalitas = oris.reduce((a, b) => a + b, 0);
    } else {
      const mi = totals.indexOf(max), ni = totals.indexOf(min);
      orisinalitas = 0;
      for (let i = 0; i < oris.length; i++) { if (i === mi || i === ni) continue; orisinalitas += oris[i]; }
    }
    return { tertinggi: jumlah >= 3 ? max : null, terendah: jumlah >= 3 ? min : null, orisinalitas, nilaiAkhir, jumlahJuri: jumlah };
  }

  function renderRekap() {
    const fg = el('r-filter-golongan').value;
    const fk = el('r-filter-kategori').value;
    const admin = isAdmin();
    el('rekapHint').classList.toggle('hidden', !admin);

    const rows = (state.nilaiRows || []).filter(r =>
      (!fg || r.golongan === fg) && (!fk || r.kategori === fk));

    // kelompokkan per peserta (nomorUrut)
    const map = {};
    rows.forEach(r => { (map[r.nomorUrut] = map[r.nomorUrut] || []).push(r); });
    const groups = Object.keys(map).map(no => {
      const grp = map[no].slice().sort((a, b) => juriNum(a.juri) - juriNum(b.juri));
      return { no, rows: grp, agg: computeGroup(grp) };
    }).sort((a, b) => (b.agg.nilaiAkhir || 0) - (a.agg.nilaiAkhir || 0));

    const body = el('tableRekapBody');
    el('rekapEmpty').classList.toggle('hidden', groups.length > 0);

    let html = '';
    groups.forEach((g, gi) => {
      const rankClass = gi === 0 ? 'rank-1' : gi === 1 ? 'rank-2' : gi === 2 ? 'rank-3' : '';
      const span = g.rows.length;
      g.rows.forEach((r, ri) => {
        const active = C.KRITERIA_PER_KATEGORI[r.kategori] || [];
        const critCells = SS_KEYS.map(key => {
          if (!active.includes(key)) return `<td class="ss-na"></td>`;
          const val = r[key];
          if (admin) {
            const rng = rangeFor(r.kategori, key);
            return `<td class="ss-cell"><input class="ss-val" type="number" inputmode="numeric"
              data-id="${escapeAttr(r.idPenilaian)}" data-key="${key}" min="${rng.min}" max="${rng.max}"
              value="${val != null && val !== '' ? val : ''}" title="${SS_SHORT[key]} (${rng.min}–${rng.max})" /></td>`;
          }
          return `<td>${val != null && val !== '' ? val : '-'}</td>`;
        }).join('');

        const totalCell = `<td class="ss-rowtotal" data-id="${escapeAttr(r.idPenilaian)}"><b>${r.totalNilai != null ? r.totalNilai : '-'}</b></td>`;
        const idAttr = escapeAttr(r.idPenilaian);
        const waktuCell = admin
          ? `<td class="ss-cell"><input class="ss-meta ss-waktu" type="text" inputmode="numeric"
              data-id="${idAttr}" data-field="waktu" value="${r.waktu != null && r.waktu !== '' ? detikToMMSS(r.waktu) : ''}"
              placeholder="m:ss" title="Waktu (menit:detik)" /></td>`
          : `<td>${r.waktu != null && r.waktu !== '' ? detikToMMSS(r.waktu) : '-'}</td>`;
        const kgCell = (admin && r.kategori === 'BERPASANGAN')
          ? `<td class="ss-cell"><input class="ss-meta ss-kg" type="number" inputmode="numeric" min="0"
              data-id="${idAttr}" data-field="keluarGelanggang" value="${r.keluarGelanggang != null && r.keluarGelanggang !== '' ? r.keluarGelanggang : 0}"
              title="Keluar Gelanggang (×)" /></td>`
          : `<td>${r.keluarGelanggang != null && r.keluarGelanggang !== '' ? r.keluarGelanggang : (r.kategori === 'BERPASANGAN' ? '0' : '-')}</td>`;
        const aksi = admin
          ? `<button class="btn-icon" data-delrow="${escapeAttr(r.idPenilaian)}" data-no="${escapeAttr(String(r.nomorUrut))}" data-juri="${escapeAttr(r.juri)}" title="Hapus baris nilai ini">🗑️</button>`
          : '—';

        let groupCells = '';
        if (ri === 0) {
          const a = g.agg, gno = escapeAttr(String(g.no));
          groupCells = `
            <td class="ss-tertinggi" data-group="${gno}" rowspan="${span}">${a.tertinggi != null ? a.tertinggi : '-'}</td>
            <td class="ss-terendah" data-group="${gno}" rowspan="${span}">${a.terendah != null ? a.terendah : '-'}</td>
            <td class="ss-orisinalitas" data-group="${gno}" rowspan="${span}">${a.orisinalitas != null ? a.orisinalitas : '-'}</td>
            <td class="ss-jml" data-group="${gno}" rowspan="${span}">${a.jumlahJuri}</td>
            <td class="ss-nilaiakhir" data-group="${gno}" rowspan="${span}"><b>${a.nilaiAkhir != null ? a.nilaiAkhir : '-'}</b></td>`;
        }

        html += `<tr class="${rankClass} ${ri === 0 ? 'ss-group-start' : ''}">
          <td>${ri === 0 ? r.nomorUrut : ''}</td>
          <td>${ri === 0 ? escapeHtml(r.namaPeserta) : ''}</td>
          <td>${ri === 0 ? (r.kontingen || '') : ''}</td>
          <td>${r.kategori || ''}</td>
          <td>${r.golongan || ''}</td>
          <td>${r.juri || ''}</td>
          <td>${escapeHtml(r.namaJuri || '')}</td>
          ${waktuCell}
          ${kgCell}
          ${critCells}
          ${totalCell}
          ${groupCells}
          <td>${aksi}</td>
        </tr>`;
      });
    });
    body.innerHTML = html;

    $$('.ss-val', body).forEach(inp => {
      inp.addEventListener('input', () => onSpreadsheetEdit(inp));
      inp.addEventListener('change', () => saveSpreadsheetCell(inp));
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    });
    $$('.ss-meta', body).forEach(inp => {
      inp.addEventListener('input', () => onMetaEdit(inp));
      inp.addEventListener('change', () => saveMetaCell(inp));
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    });
    $$('[data-delrow]', body).forEach(b => b.addEventListener('click', () => deleteNilaiRow(b.dataset.no, b.dataset.juri)));
  }

  // Live recompute total baris & agregat peserta saat sel diedit (belum disimpan).
  function onSpreadsheetEdit(input) {
    const id = input.dataset.id, key = input.dataset.key;
    const row = (state.nilaiRows || []).find(r => r.idPenilaian === id);
    if (!row) return;
    row[key] = input.value === '' ? '' : (parseFloat(input.value) || 0);
    const rng = rangeFor(row.kategori, key);
    const v = parseFloat(input.value);
    input.classList.toggle('invalid', input.value !== '' && (isNaN(v) || v < rng.min || v > rng.max));
    row.totalNilai = computeRowTotal(row);
    const tEl = document.querySelector(`.ss-rowtotal[data-id="${id}"]`);
    if (tEl) tEl.innerHTML = `<b>${row.totalNilai}</b>`;
    updateGroupCells(row.nomorUrut);
  }

  function updateGroupCells(no) {
    const grp = (state.nilaiRows || []).filter(r => String(r.nomorUrut) === String(no));
    const a = computeGroup(grp);
    const set = (cls, val) => { const c = document.querySelector(`.${cls}[data-group="${no}"]`); if (c) c.innerHTML = val; };
    set('ss-tertinggi', a.tertinggi != null ? a.tertinggi : '-');
    set('ss-terendah', a.terendah != null ? a.terendah : '-');
    set('ss-orisinalitas', a.orisinalitas != null ? a.orisinalitas : '-');
    set('ss-jml', String(a.jumlahJuri));
    set('ss-nilaiakhir', `<b>${a.nilaiAkhir != null ? a.nilaiAkhir : '-'}</b>`);
  }

  // Simpan baris penilaian (kriteria aktif + total) ke server.
  async function saveSpreadsheetCell(input) {
    const id = input.dataset.id, ek = input.dataset.key;
    const row = (state.nilaiRows || []).find(r => r.idPenilaian === id);
    if (!row) return;

    const erng = rangeFor(row.kategori, ek);
    const ev = parseFloat(input.value);
    if (input.value === '' || isNaN(ev) || ev < erng.min || ev > erng.max) {
      input.classList.add('error');
      toast(`Nilai ${SS_SHORT[ek]} harus ${erng.min}–${erng.max}.`, 'error');
      return;
    }

    const keys = C.KRITERIA_PER_KATEGORI[row.kategori] || [];
    const nilai = {};
    keys.forEach(k => { nilai[k] = Number(row[k]) || 0; });
    row.totalNilai = computeRowTotal(row);

    input.classList.remove('saved', 'error');
    input.disabled = true;
    try {
      const resp = await apiPost('editNilai', { idPenilaian: id, nilai, totalNilai: row.totalNilai });
      if (resp.success) {
        input.classList.add('saved');
        setTimeout(() => input.classList.remove('saved'), 1000);
      } else {
        input.classList.add('error');
        toast(resp.message || 'Gagal menyimpan nilai.', 'error');
      }
    } catch (e) {
      input.classList.add('error');
      toast('Koneksi gagal.', 'error');
    } finally { input.disabled = false; }
  }

  // Parse "m:ss" atau detik polos → total detik. Kembalikan null jika tak valid.
  function parseMMSS(str) {
    str = String(str).trim();
    if (str === '') return null;
    if (str.indexOf(':') >= 0) {
      const parts = str.split(':');
      const m = parseInt(parts[0], 10) || 0;
      const s = parseInt(parts[1], 10) || 0;
      if (s > 59 || s < 0 || m < 0) return null;
      return m * 60 + s;
    }
    const n = parseInt(str, 10);
    return isNaN(n) ? null : n;
  }

  // Live recompute saat Waktu / KG diedit (belum disimpan).
  function onMetaEdit(input) {
    const id = input.dataset.id, field = input.dataset.field;
    const row = (state.nilaiRows || []).find(r => r.idPenilaian === id);
    if (!row) return;
    if (field === 'waktu') {
      const det = parseMMSS(input.value);
      row.waktu = det == null ? 0 : det;
      input.classList.toggle('invalid', input.value !== '' && det == null);
    } else {
      const kg = input.value === '' ? 0 : (parseInt(input.value, 10));
      row.keluarGelanggang = isNaN(kg) ? 0 : kg;
      input.classList.toggle('invalid', input.value !== '' && (isNaN(kg) || kg < 0));
    }
    row.totalNilai = computeRowTotal(row);
    const tEl = document.querySelector(`.ss-rowtotal[data-id="${id}"]`);
    if (tEl) tEl.innerHTML = `<b>${row.totalNilai}</b>`;
    updateGroupCells(row.nomorUrut);
  }

  // Simpan Waktu / KG ke server (juga memperbarui total).
  async function saveMetaCell(input) {
    const id = input.dataset.id, field = input.dataset.field;
    const row = (state.nilaiRows || []).find(r => r.idPenilaian === id);
    if (!row) return;
    const payload = { idPenilaian: id };

    if (field === 'waktu') {
      const det = parseMMSS(input.value);
      if (det == null || det < 0) {
        input.classList.add('error');
        toast('Format waktu harus m:ss (mis. 2:34).', 'error');
        return;
      }
      row.waktu = det;
      payload.waktu = det;
      input.value = detikToMMSS(det); // normalkan tampilan
    } else {
      const kg = input.value === '' ? 0 : parseInt(input.value, 10);
      if (isNaN(kg) || kg < 0) {
        input.classList.add('error');
        toast('Keluar Gelanggang tidak valid.', 'error');
        return;
      }
      row.keluarGelanggang = kg;
      payload.keluarGelanggang = kg;
    }

    row.totalNilai = computeRowTotal(row);
    payload.totalNilai = row.totalNilai;

    input.classList.remove('saved', 'error');
    input.disabled = true;
    try {
      const resp = await apiPost('editNilai', payload);
      if (resp.success) {
        input.classList.add('saved');
        setTimeout(() => input.classList.remove('saved'), 1000);
      } else {
        input.classList.add('error');
        toast(resp.message || 'Gagal menyimpan.', 'error');
      }
    } catch (e) {
      input.classList.add('error');
      toast('Koneksi gagal.', 'error');
    } finally { input.disabled = false; }
  }

  async function deleteNilaiRow(nomorUrut, juri) {
    if (!confirm(`Hapus nilai ${juri} untuk peserta ${nomorUrut}?`)) return;
    showLoader(true);
    try {
      const resp = await apiPost('deleteNilai', { nomorUrut, juri });
      if (resp.success) { toast('Nilai dihapus.'); loadRekap(true); }
      else toast(resp.message || 'Gagal menghapus.', 'error');
    } catch (e) { toast('Koneksi gagal.', 'error'); }
    finally { showLoader(false); }
  }

  async function openEditNilai(nomorUrut) {
    showLoader(true);
    let nilaiList = [];
    try {
      const resp = await apiGet('getNilaiByPeserta', { nomorUrut });
      nilaiList = resp.data || resp || [];
    } catch (e) { showLoader(false); return toast('Gagal memuat nilai.', 'error'); }
    showLoader(false);
    if (!nilaiList.length) return toast('Belum ada nilai untuk peserta ini.', 'error');

    const p = nilaiList[0];
    const keys = C.KRITERIA_PER_KATEGORI[p.kategori] || [];
    el('editNilaiTitle').textContent = `Edit Nilai ${nomorUrut}`;
    el('editNilaiBody').innerHTML = `
      <div class="field"><label>Pilih Juri</label><select id="en-juri"></select></div>
      <div id="en-fields"></div>
      <div class="en-actions">
        <button class="btn-primary" id="en-save">Update Nilai</button>
      </div>`;
    const sel = el('en-juri');
    nilaiList.forEach(n => sel.appendChild(new Option(`${n.juri} — ${n.namaJuri}`, n.idPenilaian)));

    function renderFields() {
      const n = nilaiList.find(x => x.idPenilaian === sel.value);
      el('en-fields').innerHTML = keys.map(key => {
        const meta = kriteriaMeta(key);
        const r = rangeFor(p.kategori, key);
        return `<div class="field"><label>${meta.nama} <span class="range-hint">${r.min}–${r.max}</span></label>
          <input type="number" class="en-kriteria" id="en-${key}" value="${n[key] != null ? n[key] : ''}" min="${r.min}" max="${r.max}" /></div>`;
      }).join('') +
      `<div class="en-total-box"><div class="en-total-label">TOTAL NILAI</div><div class="en-total-value" id="en-total-display">0</div></div>
      <input type="hidden" id="en-total" value="0" />`;
      // Tambahkan event listener live recalc
      $$('.en-kriteria', el('en-fields')).forEach(inp => {
        inp.addEventListener('input', recalcEditTotal);
      });
      recalcEditTotal();
    }

    function recalcEditTotal() {
      let total = 0;
      $$('.en-kriteria', el('en-fields')).forEach(inp => {
        total += parseFloat(inp.value) || 0;
      });
      el('en-total').value = total;
      el('en-total-display').textContent = total;
    }

    sel.addEventListener('change', renderFields);
    renderFields();

    el('en-save').addEventListener('click', async () => {
      const idPenilaian = sel.value;
      const nilai = {};
      keys.forEach(key => { nilai[key] = parseFloat(el('en-' + key).value) || 0; });
      const totalNilai = parseFloat(el('en-total').value) || 0;
      showLoader(true);
      try {
        const resp = await apiPost('editNilai', { idPenilaian, nilai, totalNilai });
        if (resp.success) { toast('Nilai diperbarui.'); closeModal('editNilaiModal'); loadRekap(true); }
        else toast(resp.message || 'Gagal.', 'error');
      } catch (e) { toast('Koneksi gagal.', 'error'); }
      finally { showLoader(false); }
    });
    openModal('editNilaiModal');
  }

  async function openDeleteNilai(nomorUrut) {
    showLoader(true);
    let nilaiList = [];
    try {
      const resp = await apiGet('getNilaiByPeserta', { nomorUrut });
      nilaiList = resp.data || resp || [];
    } catch (e) { showLoader(false); return toast('Gagal memuat nilai.', 'error'); }
    showLoader(false);
    if (!nilaiList.length) return toast('Belum ada nilai.', 'error');

    const juriOpt = nilaiList.map(n => `${n.juri}`);
    const pilih = prompt(`Hapus nilai juri mana untuk ${nomorUrut}?\nTersedia: ${juriOpt.join(', ')}\nKetik nama juri persis:`);
    if (!pilih) return;
    if (!juriOpt.includes(pilih.trim())) return toast('Juri tidak ditemukan.', 'error');

    showLoader(true);
    try {
      const resp = await apiPost('deleteNilai', { nomorUrut, juri: pilih.trim() });
      if (resp.success) { toast('Nilai dihapus.'); loadRekap(true); }
      else toast(resp.message || 'Gagal menghapus.', 'error');
    } catch (e) { toast('Koneksi gagal.', 'error'); }
    finally { showLoader(false); }
  }

  /* ====================================================================== *
   * ADMIN — GELANGGANG & ANTRIAN
   * ====================================================================== */
  async function loadGelanggangAdmin() {
    showLoader(true);
    try {
      await fetchPeserta();
      const resp = await apiGet('getGelanggang');
      state.gelanggang = resp.data || resp || [];
      // ambil antrian tiap gelanggang
      for (const g of state.gelanggang) {
        try {
          const ra = await apiGet('getAntrianByGelanggang', { id: g.id });
          g._antrian = ra.data || ra || [];
        } catch (e) { g._antrian = []; }
      }
      renderGelanggangAdmin();
    } catch (e) { toast('Gagal memuat gelanggang.', 'error'); }
    finally { showLoader(false); }
  }

  function renderGelanggangAdmin() {
    const wrap = el('gelanggangList');
    const list = state.gelanggang || [];
    el('gelanggangEmpty').classList.toggle('hidden', list.length > 0);
    wrap.innerHTML = list.map(g => {
      const antrian = (g._antrian || []).filter(a => a.status !== 'SELESAI');
      const aktif = antrian.find(a => a.status === 'TAMPIL');
      const menunggu = antrian.filter(a => a.status === 'MENUNGGU');
      const badgeClass = aktif ? 'gel-badge-aktif' : 'gel-badge-idle';
      const badgeText = aktif ? 'ADA PESERTA TAMPIL' : 'IDLE';

      const aktifBox = aktif ? `
        <div class="gel-aktif">
          <div class="gel-aktif-label">▶ SEDANG TAMPIL</div>
          <div class="gel-aktif-nama">${escapeHtml(aktif.namaPeserta || aktif.nomorUrut)}</div>
          <div class="gel-aktif-meta">${aktif.nomorUrut} · ${aktif.kategori || ''} · ${aktif.golongan || ''}</div>
          <button class="btn-primary gel-btn-selesai" data-selesai="${aktif.idAntrian}">✔ Selesai</button>
        </div>` : `<div class="gel-aktif-kosong">Belum ada peserta tampil.</div>`;

      const antrianList = menunggu.length ? `
        <div class="gel-antrian-title">Antrian Berikutnya (${menunggu.length})</div>
        <ol class="gel-antrian-list">
          ${menunggu.map((a, i) => `
            <li>
              <span class="ga-order">
                <button class="btn-icon ga-move" data-up="${a.idAntrian}" title="Naikkan" ${i === 0 ? 'disabled' : ''}>▲</button>
                <button class="btn-icon ga-move" data-down="${a.idAntrian}" title="Turunkan" ${i === menunggu.length - 1 ? 'disabled' : ''}>▼</button>
              </span>
              <span class="ga-nama">${escapeHtml(a.namaPeserta || a.nomorUrut)}</span>
              <span class="ga-meta">${a.nomorUrut}</span>
              <span class="ga-actions">
                ${!aktif ? `<button class="btn-icon" data-mulai="${a.idAntrian}" title="Mulai tampil">▶</button>` : ''}
                <button class="btn-icon" data-hapus="${a.idAntrian}" title="Hapus dari antrian">🗑️</button>
              </span>
            </li>`).join('')}
        </ol>` : '<div class="gel-antrian-empty">Antrian kosong.</div>';

      return `<div class="card gel-card">
        <div class="gel-head">
          <div class="gel-nama">${escapeHtml(g.nama)}</div>
          <span class="gel-badge ${badgeClass}">${badgeText}</span>
        </div>
        ${aktifBox}
        ${antrianList}
        <button class="btn-secondary gel-btn-tambah" data-tambah="${g.id}">+ Tambah ke Antrian</button>
      </div>`;
    }).join('');

    $$('[data-tambah]', wrap).forEach(b => b.addEventListener('click', () => openAddAntrian(b.dataset.tambah)));
    $$('[data-mulai]', wrap).forEach(b => b.addEventListener('click', () => doMulaiTampil(b.dataset.mulai)));
    $$('[data-selesai]', wrap).forEach(b => b.addEventListener('click', () => doSelesaiTampil(b.dataset.selesai)));
    $$('[data-hapus]', wrap).forEach(b => b.addEventListener('click', () => doHapusAntrian(b.dataset.hapus)));
    $$('[data-up]', wrap).forEach(b => b.addEventListener('click', () => doMoveAntrian(b.dataset.up, 'up')));
    $$('[data-down]', wrap).forEach(b => b.addEventListener('click', () => doMoveAntrian(b.dataset.down, 'down')));
  }

  async function tambahGelanggang() {
    const nama = prompt('Nama gelanggang baru:', 'Gelanggang ' + String.fromCharCode(65 + (state.gelanggang || []).length));
    if (!nama) return;
    showLoader(true);
    try {
      const resp = await apiPost('addGelanggang', { nama: nama.trim() });
      if (resp.success) { toast(`Gelanggang dibuat (${resp.id}).`); loadGelanggangAdmin(); loadGelanggangOptions(); }
      else toast(resp.message || 'Gagal membuat gelanggang.', 'error');
    } catch (e) { toast('Koneksi gagal.', 'error'); }
    finally { showLoader(false); }
  }

  function openAddAntrian(idGelanggang) {
    state.addAntrianGelanggang = idGelanggang;
    el('aa-cari').value = '';
    el('aa-list').innerHTML = '';
    openModal('addAntrianModal');
    setTimeout(() => el('aa-cari').focus(), 60);
  }

  function onCariAntrian() {
    const q = el('aa-cari').value.trim().toLowerCase();
    const listEl = el('aa-list');
    if (!q) { listEl.innerHTML = ''; return; }
    const matches = state.peserta.filter(p =>
      (p.namaPeserta || '').toLowerCase().includes(q) ||
      String(p.nomorUrut).toLowerCase().includes(q)).slice(0, 10);
    listEl.innerHTML = matches.map(p => `
      <div class="ac-item" data-no="${p.nomorUrut}">
        ${escapeHtml(p.namaPeserta)}<br><small>${p.nomorUrut} • ${p.kategori} • ${p.golongan}</small>
      </div>`).join('');
    $$('.ac-item', listEl).forEach(item =>
      item.addEventListener('click', () => doAddAntrian(item.dataset.no)));
  }

  async function doAddAntrian(nomorUrut) {
    const idGelanggang = state.addAntrianGelanggang;
    if (!idGelanggang) return;
    showLoader(true);
    try {
      const resp = await apiPost('addAntrian', { idGelanggang, nomorUrut });
      if (resp.success) {
        toast('Peserta ditambahkan ke antrian.');
        closeModal('addAntrianModal');
        loadGelanggangAdmin();
        pushEvent('antrian-updated', { gelanggang: idGelanggang });
      } else toast(resp.message || 'Gagal menambah antrian.', 'error');
    } catch (e) { toast('Koneksi gagal.', 'error'); }
    finally { showLoader(false); }
  }

  async function doMulaiTampil(idAntrian) {
    showLoader(true);
    try {
      const resp = await apiPost('mulaiTampil', { idAntrian });
      if (resp.success) { toast('Peserta mulai tampil.'); loadGelanggangAdmin(); pushEvent('antrian-updated', {}); }
      else toast(resp.message || 'Gagal memulai tampil.', 'error');
    } catch (e) { toast('Koneksi gagal.', 'error'); }
    finally { showLoader(false); }
  }

  async function doSelesaiTampil(idAntrian) {
    if (!confirm('Tandai peserta ini SELESAI dan aktifkan peserta berikutnya?')) return;
    showLoader(true);
    try {
      const resp = await apiPost('selesaiTampil', { idAntrian });
      if (resp.success) { toast('Selesai. Peserta berikutnya diaktifkan.'); loadGelanggangAdmin(); pushEvent('antrian-updated', {}); }
      else toast(resp.message || 'Gagal.', 'error');
    } catch (e) { toast('Koneksi gagal.', 'error'); }
    finally { showLoader(false); }
  }

  async function doHapusAntrian(idAntrian) {
    if (!confirm('Hapus peserta ini dari antrian?')) return;
    showLoader(true);
    try {
      const resp = await apiPost('hapusAntrian', { idAntrian });
      if (resp.success) { toast('Dihapus dari antrian.'); loadGelanggangAdmin(); pushEvent('antrian-updated', {}); }
      else toast(resp.message || 'Gagal menghapus.', 'error');
    } catch (e) { toast('Koneksi gagal.', 'error'); }
    finally { showLoader(false); }
  }

  async function doMoveAntrian(idAntrian, direction) {
    showLoader(true);
    try {
      const resp = await apiPost('moveAntrian', { idAntrian, direction });
      if (resp.success) {
        if (resp.moved === false) { toast('Sudah di ujung urutan.'); }
        loadGelanggangAdmin();
        pushEvent('antrian-updated', {});
      } else toast(resp.message || 'Gagal mengubah urutan.', 'error');
    } catch (e) { toast('Koneksi gagal.', 'error'); }
    finally { showLoader(false); }
  }

  /* ====================================================================== *
   * ADMIN — GENERATE PIN JURI
   * ====================================================================== */
  async function generatePin() {
    const keterangan = el('gp-keterangan').value.trim();
    const berlakuHingga = el('gp-berlaku').value;
    if (!keterangan) return toast('Isi keterangan PIN dahulu.', 'error');
    showLoader(true);
    el('btnGeneratePin').disabled = true;
    try {
      const resp = await apiPost('generatePinJuri', { keterangan, berlakuHingga });
      if (resp.success) {
        el('gp-pin-value').textContent = resp.pin;
        el('gp-result').classList.remove('hidden');
        el('gp-keterangan').value = '';
        el('gp-berlaku').value = '';
        toast('PIN Juri dibuat.');
        loadPinList();
      } else toast(resp.message || 'Gagal generate PIN.', 'error');
    } catch (e) { toast('Koneksi gagal.', 'error'); }
    finally { showLoader(false); el('btnGeneratePin').disabled = false; }
  }

  function copyGeneratedPin() {
    const pin = el('gp-pin-value').textContent.trim();
    if (!pin || pin === '------') return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pin).then(() => toast('PIN disalin.')).catch(() => toast('Gagal menyalin.', 'error'));
    } else {
      toast('Clipboard tidak didukung. Salin manual: ' + pin);
    }
  }

  async function loadPinList() {
    showLoader(true);
    try {
      const resp = await apiGet('getPinList');
      state.pinList = resp.data || resp || [];
      renderPinList();
    } catch (e) { toast('Gagal memuat daftar PIN.', 'error'); }
    finally { showLoader(false); }
  }

  function renderPinList() {
    const body = el('pinListBody');
    const list = state.pinList || [];
    el('pinListEmpty').classList.toggle('hidden', list.length > 0);
    body.innerHTML = list.map(p => {
      const last = p.terakhirDigunakan ? new Date(p.terakhirDigunakan).toLocaleString('id-ID') : '-';
      const statusCls = p.status === 'AKTIF' ? 'pin-aktif' : 'pin-nonaktif';
      const revokeBtn = p.status === 'AKTIF'
        ? `<button class="btn-icon" data-revoke="${p.pin}" title="Nonaktifkan">🚫</button>` : '';
      return `<tr>
        <td><b>${p.pin}</b></td>
        <td>${escapeHtml(p.keterangan || '-')}</td>
        <td><span class="${statusCls}">${p.status}</span></td>
        <td>${last}</td>
        <td>${revokeBtn}</td>
      </tr>`;
    }).join('');
    $$('[data-revoke]', body).forEach(b => b.addEventListener('click', () => revokePin(b.dataset.revoke)));
  }

  async function revokePin(pin) {
    if (!confirm(`Nonaktifkan PIN ${pin}? Juri dengan PIN ini tidak bisa login lagi.`)) return;
    showLoader(true);
    try {
      const resp = await apiPost('revokePin', { pin });
      if (resp.success) { toast('PIN dinonaktifkan.'); loadPinList(); }
      else toast(resp.message || 'Gagal.', 'error');
    } catch (e) { toast('Koneksi gagal.', 'error'); }
    finally { showLoader(false); }
  }

  /* ====================================================================== *
   * HALAMAN 4 — HASIL (publik)
   * ====================================================================== */
  function initHasil() {
    fillSelect(el('h-filter-kategori'), C.KATEGORI, { all: true });
    fillSelect(el('h-filter-golongan'), allGolonganList(), { all: true });
    el('h-filter-kategori').addEventListener('change', renderHasil);
    el('h-filter-golongan').addEventListener('change', renderHasil);
    el('btnRefreshHasil').addEventListener('click', () => loadHasil(true));
  }

  async function loadHasil(force = false) {
    showLoader(true);
    try {
      const resp = await apiGet('getRekap');
      state.rekap = resp.data || resp || [];
      renderHasil();
    } catch (e) { toast('Gagal memuat hasil.', 'error'); }
    finally { showLoader(false); }
  }

  function renderHasil() {
    const fk = el('h-filter-kategori').value;
    const fg = el('h-filter-golongan').value;
    let list = (state.rekap || []).filter(r =>
      (!fk || r.kategori === fk) && (!fg || r.golongan === fg) && r.nilaiAkhir != null);

    // group per kategori+golongan
    const groups = {};
    list.forEach(r => {
      const k = `${r.kategori}||${r.golongan}`;
      (groups[k] = groups[k] || []).push(r);
    });

    // Juara umum: hitung medali (1/2/3) per kontingen di setiap grup
    const medali = {}; // kontingen -> {emas,perak,perunggu}
    Object.values(groups).forEach(arr => {
      arr.sort((a, b) => b.nilaiAkhir - a.nilaiAkhir);
      arr.slice(0, 3).forEach((r, i) => {
        const m = medali[r.kontingen] = medali[r.kontingen] || { emas: 0, perak: 0, perunggu: 0 };
        if (i === 0) m.emas++; else if (i === 1) m.perak++; else m.perunggu++;
      });
    });

    const juara = Object.entries(medali).map(([kontingen, m]) => ({
      kontingen, ...m,
      poin: m.emas * 3 + m.perak * 2 + m.perunggu * 1,
      skor: m.emas * 1000000 + m.perak * 1000 + m.perunggu
    })).sort((a, b) => b.skor - a.skor);

    el('juaraUmum').innerHTML = juara.length ? `
      <div class="juara-list">
        ${juara.map((j, i) => {
          const rankClass = i === 0 ? 'juara-emas' : i === 1 ? 'juara-silver' : i === 2 ? 'juara-perunggu' : '';
          const medalIcon = ['🥇', '🥈', '🥉'][i] || '🏅';
          const rankNum = i + 1;
          return `<div class="juara-row ${rankClass}">
            <div class="juara-rank">
              <span class="juara-medal">${medalIcon}</span>
              <span class="juara-pos">${rankNum}</span>
            </div>
            <div class="juara-body">
              <div class="juara-nama">${j.kontingen}</div>
              <div class="juara-medali">🥇${j.emas} &nbsp; 🥈${j.perak} &nbsp; 🥉${j.perunggu}</div>
            </div>
            <div class="juara-poin">
              <div class="juara-poin-label">POIN</div>
              <div class="juara-poin-value">${j.poin}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <p class="juara-keterangan">*Poin: Emas ×3 · Silver ×2 · Perunggu ×1 · Tiebreaker: Emas → Silver → Perunggu</p>
    ` : '<div class="empty-state">Belum ada hasil.</div>';

    // group cards
    const wrap = el('hasilGroups');
    const keys = Object.keys(groups).sort();
    wrap.innerHTML = keys.length ? keys.map(k => {
      const [kat, gol] = k.split('||');
      const arr = groups[k].sort((a, b) => b.nilaiAkhir - a.nilaiAkhir);
      const totalPeserta = arr.length;
      const cards = arr.map((r, i) => {
        const rank = i + 1;
        const medalIcons = ['🥇', '🥈', '🥉'];
        const medalLabels = ['EMAS', 'SILVER', 'PERUNGGU'];
        const rcl = rank <= 3 ? `r${rank}` : '';
        const rankContent = rank <= 3
          ? `<div class="hc-medal-icon">${medalIcons[i]}</div><div class="hc-medal-label">${medalLabels[i]}</div>`
          : `<div class="hc-rank-num">${rank}</div>`;
        const juriInfo = r.jumlahJuri ? `${r.jumlahJuri}/5 Juri menilai` : '- Juri menilai';
        return `<div class="hasil-card ${rcl}">
          <div class="hc-rank">${rankContent}</div>
          <div class="hc-body">
            <div class="hc-nama">${escapeHtml(r.namaPeserta)}</div>
            <div class="hc-meta">${r.nomorUrut} · ${r.kontingen}</div>
            <div class="hc-juri">${juriInfo}</div>
          </div>
          <div class="hc-score">
            <div class="hc-score-label">NILAI AKHIR</div>
            <div class="hc-score-value">${r.nilaiAkhir}</div>
          </div>
        </div>`;
      }).join('');
      return `<div class="hasil-group">
        <div class="hasil-group-header">
          <span class="hgh-pill">Kategori <b>${kat}</b></span>
          <span class="hgh-pill">Golongan <b>${gol}</b></span>
          <span class="hgh-pill">Peserta <b>${totalPeserta}</b></span>
        </div>
        <div class="hasil-group-cards">${cards}</div>
      </div>`;
    }).join('') : '<div class="card"><div class="empty-state">Belum ada hasil untuk filter ini.</div></div>';
  }

  /* ====================== ESCAPING ====================== */
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

  /* ====================== MODAL CLOSE BUTTONS ====================== */
  function initModals() {
    $$('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
    // close on overlay click (kecuali PIN modal yang wajib)
    $$('.modal-overlay').forEach(ov => {
      ov.addEventListener('click', e => {
        if (e.target === ov && ov.id !== 'pinModal') ov.classList.add('hidden');
      });
    });
  }

  /* ====================== HEADER & PWA ====================== */
  function initHeader() {
    if (C.EVENT) {
      el('appTitle').textContent = C.EVENT.nama || 'Pasanggiri ASAD';
      el('appSubtitle').textContent = C.EVENT.subjudul || '';
    }
  }

  function registerSW() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {});
      });
    }
  }

  /* ====================== PUSHER REAL-TIME ====================== */
  let pusher = null;
  let pusherChannel = null;

  // Trigger Pusher event via Vercel serverless API (lebih reliable dari Apps Script).
  async function pushEvent(event, data) {
    try {
      await fetch('/api/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, data: data || {} })
      });
    } catch (e) {
      console.warn('[Pusher] Trigger failed:', e.message);
    }
  }

  function updatePusherDot(state) {
    const dot = el('pusherStatus');
    if (!dot) return;
    const map = {
      connected:    { icon: '🟢', title: 'Real-time: terhubung' },
      connecting:   { icon: '🟡', title: 'Real-time: menghubungkan...' },
      disconnected: { icon: '🔴', title: 'Real-time: terputus' },
      error:        { icon: '🔴', title: 'Real-time: gagal terhubung' }
    };
    const s = map[state] || map.disconnected;
    dot.textContent = s.icon;
    dot.title = s.title;
  }

  function initPusher() {
    if (!C.PUSHER || !C.PUSHER.APP_KEY || C.PUSHER.APP_KEY === 'GANTI_DENGAN_PUSHER_APP_KEY') {
      console.warn('[Pusher] APP_KEY belum dikonfigurasi.');
      return;
    }
    if (typeof Pusher === 'undefined') {
      console.warn('[Pusher] Library pusher-js belum dimuat. Pastikan CDN bisa diakses.');
      return;
    }

    Pusher.logToConsole = false; // set true untuk debug

    pusher = new Pusher(C.PUSHER.APP_KEY, {
      cluster: C.PUSHER.CLUSTER || 'ap1',
      forceTLS: true
    });

    pusher.connection.bind('connected', function () {
      console.log('[Pusher] Connected. Socket ID:', pusher.connection.socket_id);
      updatePusherDot('connected');
    });
    pusher.connection.bind('error', function (err) {
      console.error('[Pusher] Connection error:', err);
      updatePusherDot('error');
    });
    pusher.connection.bind('disconnected', function () {
      updatePusherDot('disconnected');
    });
    pusher.connection.bind('connecting', function () {
      updatePusherDot('connecting');
    });

    pusherChannel = pusher.subscribe('pasanggiri');

    pusherChannel.bind('pusher:subscription_succeeded', function () {
      console.log('[Pusher] Subscribed to channel: pasanggiri');
    });
    pusherChannel.bind('pusher:subscription_error', function (status) {
      console.error('[Pusher] Subscription error:', status);
    });

    // Event: antrian berubah (Admin memulai/selesai/tambah/hapus/geser antrian)
    pusherChannel.bind('antrian-updated', function (data) {
      console.log('[Pusher] Event antrian-updated:', data);
      // Juri: refresh peserta aktif di gelanggang yang sedang dipilih
      const selGel = el('fn-gelanggang');
      const gelValue = selGel ? selGel.value : '';
      console.log('[Pusher] fn-gelanggang value:', gelValue);

      if (gelValue) {
        loadPesertaAktif();
        toast('🔄 Data peserta diperbarui.', 'success');
      } else {
        // Gelanggang belum dipilih, tapi notif tetap muncul agar Juri tahu ada perubahan
        if (hasValidToken()) {
          toast('📢 Antrian berubah. Pilih gelanggang untuk melihat.', 'success');
        }
      }
      // Admin: refresh panel gelanggang jika sedang terbuka
      const panelAntrian = el('subtab-antrian');
      if (panelAntrian && panelAntrian.classList.contains('active')) {
        loadGelanggangAdmin();
      }
    });

    // Event: juri kirim nilai → Admin bisa lihat update
    pusherChannel.bind('nilai-submitted', function (data) {
      console.log('[Pusher] Event nilai-submitted:', data);
      // Refresh rekap jika sedang terbuka
      const panelRekap = el('subtab-rekap');
      if (panelRekap && panelRekap.classList.contains('active')) {
        loadRekap(true);
      }
      // Refresh gelanggang (badge juri done bisa berubah)
      const panelAntrian = el('subtab-antrian');
      if (panelAntrian && panelAntrian.classList.contains('active')) {
        loadGelanggangAdmin();
      }
      // Refresh juri badges di form nilai (jika peserta sama)
      if (state.selectedPeserta && data && String(data.nomorUrut) === String(state.selectedPeserta.nomorUrut)) {
        renderJuriBadges();
      }
    });
  }

  /* ====================== INIT ====================== */
  async function loadKontingen() {
    try {
      const resp = await apiGet('getKontingen');
      const list = resp.data || [];
      if (list.length) state.kontingen = list;
    } catch (e) {
      // Tetap jalan meski gagal — dropdown kontingen akan kosong
      toast('Gagal memuat daftar kontingen. Periksa koneksi.', 'error');
    }
  }

  function populateKontingenDropdowns() {
    // Isi ulang semua dropdown kontingen setelah data berhasil dimuat
    fillSelect(el('f-kontingen'), state.kontingen, { placeholder: 'Pilih kontingen' });
    fillSelect(el('d-filter-kontingen'), state.kontingen, { all: true });
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initHeader();
    initNav();
    initModals();
    initPusher();
    registerSW();

    // Muat kontingen dari server sebelum inisialisasi form
    showLoader(true);
    await loadKontingen();
    showLoader(false);

    initForm();
    initDashboard();
    initPenilaian();
    initHasil();
    populateKontingenDropdowns();
    onKategoriChange(); // siapkan input peserta default jika ada
  });

})();
```

### `apps-script/Code.gs`

```js
/* ==========================================================================
 * Code.gs — Backend Pasanggiri Persinas ASAD (Google Apps Script Web App) v3
 * --------------------------------------------------------------------------
 * Deploy: New Deployment → Web App → Execute as: Me → Who has access: Anyone
 *
 * Jalankan initSheets() sekali untuk membuat semua sheet + seed PIN Admin.
 * initSheets() bersifat idempotent — aman dijalankan berkali-kali.
 *
 * 3 LEVEL AKSES:
 *   - Publik : tanpa PIN
 *   - JURI   : PIN dibuat Admin (gratis)
 *   - ADMIN  : PIN berbayar (dari developer)
 *
 * ⚠️ PIN tidak pernah ada di frontend. Semua logika PIN di sini.
 * ========================================================================== */

// ⚠️ Ganti dengan ID Google Spreadsheet milikmu
var SPREADSHEET_ID = 'GANTI_DENGAN_ID_SPREADSHEET';

// ⚠️ Pusher credentials — tidak lagi dipakai di sini (dipindahkan ke Vercel serverless).
// Trigger Pusher kini dilakukan oleh frontend via /api/trigger setelah aksi berhasil.

var SHEETS = {
  PESERTA: 'Peserta',
  PENILAIAN: 'Penilaian',
  AKSES: 'AksesJuri',
  KONTINGEN: 'Kontingen',
  GELANGGANG: 'Gelanggang',
  ANTRIAN: 'AntrianAktif'
};

var HEADERS = {
  PESERTA: ['Nomor Urut', 'Kategori', 'Golongan', 'Kontingen', 'Nama Peserta', 'Timestamp'],
  PENILAIAN: ['ID Penilaian', 'Nomor Urut Peserta', 'Kategori', 'Golongan', 'Kontingen', 'Nama Peserta',
    'Juri', 'Nama Juri', 'Waktu', 'Keluar Gelanggang',
    'Orisinalitas', 'Kemantapan', 'Stamina', 'Kekompakan', 'Kreatifitas',
    'Kekayaan Teknik', 'Teknik Serang Bela', 'Penghayatan', 'Total Nilai', 'Timestamp'],
  AKSES: ['PIN', 'Role', 'Keterangan', 'Berlaku Hingga', 'Status', 'Dibuat', 'Terakhir Digunakan'],
  KONTINGEN: ['Nama', 'Kode'],
  GELANGGANG: ['ID Gelanggang', 'Nama Gelanggang', 'Status'],
  ANTRIAN: ['ID Antrian', 'ID Gelanggang', 'Nomor Urut Peserta', 'Urutan', 'Status', 'Timestamp Mulai']
};

// Urutan kriteria di sheet Penilaian (kolom 11–18)
var KRITERIA_KEYS = ['orisinalitas', 'kemantapan', 'stamina', 'kekompakan',
  'kreatifitas', 'kekayaanTeknik', 'teknikSerangBela', 'penghayatan'];

// Kode untuk membentuk nomor urut
var KODE_KATEGORI = { 'PERORANGAN': 'PER', 'BERPASANGAN': 'BPS', 'BERKELOMPOK': 'BKL', 'MASSAL': 'MSL', 'ATT': 'ATT' };
var KODE_GOLONGAN = { 'Usia Dini': 'UDN', 'Pra Remaja': 'PRM', 'Remaja': 'RMJ', 'Dewasa': 'DWS', 'Pembina': 'PBN', 'Istimewa': 'IST', 'Campuran': 'CMP' };
// Kode kontingen diturunkan dari sheet—lihat helper kodeKontingen()

/* ====================== ROUTING ====================== */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  var p = (e && e.parameter) || {};
  try {
    switch (action) {
      case 'getAll':                return out(ok({ data: getAll() }));
      case 'getByKontingen':        return out(ok({ data: getByKontingen(p.kontingen) }));
      case 'getNextId':             return out(ok({ nomorUrut: getNextId(p.kontingen, p.golongan, p.kategori) }));
      case 'getNilaiByPeserta':     return out(ok({ data: getNilaiByPeserta(p.nomorUrut) }));
      case 'getAllNilai':           return out(ok({ data: getAllNilai() }));
      case 'getRekap':              return out(ok({ data: getRekap() }));
      case 'getKontingen':          return out(ok({ data: getKontingen() }));
      case 'getGelanggang':         return out(ok({ data: getGelanggang() }));
      case 'getAntrianByGelanggang':return out(ok({ data: getAntrianByGelanggang(p.id) }));
      case 'getPesertaAktif':       return out(ok({ data: getPesertaAktif(p.id) }));
      case 'getPinList':            return out(ok({ data: getPinList() }));
      default:                      return out(err('Action GET tidak dikenal: ' + action));
    }
  } catch (ex) {
    return out(err(ex.message));
  }
}

function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (ex) { return out(err('Body tidak valid.')); }
  var action = body.action || '';
  try {
    switch (action) {
      case 'add':             return out(addPeserta(body));
      case 'update':          return out(updatePeserta(body));
      case 'delete':          return out(deletePeserta(body));
      case 'addNilai':        return out(addNilai(body));
      case 'editNilai':       return out(editNilai(body));
      case 'deleteNilai':     return out(deleteNilai(body));
      case 'validatePin':     return out(validatePin(body.pin));
      case 'generatePinJuri': return out(generatePinJuri(body.keterangan, body.berlakuHingga));
      case 'generatePin':     return out(generatePinJuri(body.keterangan, body.berlakuHingga)); // alias kompatibilitas
      case 'revokePin':       return out(revokePin(body.pin));
      case 'addGelanggang':   return out(addGelanggang(body));
      case 'addAntrian':      return out(addAntrian(body));
      case 'mulaiTampil':     return out(mulaiTampil(body));
      case 'selesaiTampil':   return out(selesaiTampil(body));
      case 'hapusAntrian':    return out(hapusAntrian(body));
      case 'moveAntrian':     return out(moveAntrian(body));
      default:                return out(err('Action POST tidak dikenal: ' + action));
    }
  } catch (ex) {
    return out(err(ex.message));
  }
}

/* ====================== RESPONSE HELPERS ====================== */
function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function ok(extra) { return Object.assign({ success: true }, extra || {}); }
function err(message) { return { success: false, message: message || 'Terjadi kesalahan.' }; }

/* ====================== SHEET HELPERS ====================== */
function ss() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

function getSheet(name) {
  var s = ss().getSheetByName(name);
  if (!s) {
    s = ss().insertSheet(name);
    if (HEADERS[invName(name)]) {
      s.getRange(1, 1, 1, HEADERS[invName(name)].length).setValues([HEADERS[invName(name)]]);
      s.setFrozenRows(1);
    }
  }
  return s;
}
function invName(sheetName) {
  for (var k in SHEETS) if (SHEETS[k] === sheetName) return k;
  return sheetName;
}

function initSheets() {
  getSheet(SHEETS.PESERTA);
  getSheet(SHEETS.PENILAIAN);

  // --- AksesJuri (dengan migrasi schema lama → tambah kolom Role) ---
  var akses = getSheet(SHEETS.AKSES);
  migrateAksesSchema(akses);
  if (akses.getLastRow() < 2) {
    // Seed PIN Admin default
    akses.appendRow(['335544', 'ADMIN', 'PIN Admin Default', '', 'AKTIF', new Date().toISOString(), '']);
  }

  // --- Kontingen — seed 5 kontingen default jika kosong ---
  var kontingen = getSheet(SHEETS.KONTINGEN);
  if (kontingen.getLastRow() < 2) {
    var seeds = [
      ['Kontingen 1', 'K01'],
      ['Kontingen 2', 'K02'],
      ['Kontingen 3', 'K03'],
      ['Kontingen 4', 'K04'],
      ['Kontingen 5', 'K05']
    ];
    kontingen.getRange(2, 1, seeds.length, 2).setValues(seeds);
  }

  // --- Gelanggang & AntrianAktif (header dibuat otomatis) ---
  getSheet(SHEETS.GELANGGANG);
  getSheet(SHEETS.ANTRIAN);

  return 'initSheets selesai (v3).';
}

// Migrasi sheet AksesJuri dari schema lama (tanpa Role) ke schema baru (dengan Role di kolom B).
function migrateAksesSchema(sheet) {
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, HEADERS.AKSES.length).setValues([HEADERS.AKSES]);
    sheet.setFrozenRows(1);
    return;
  }
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  // Sudah ada kolom Role di posisi B → tidak perlu migrasi.
  if (String(header[1]).trim() === 'Role') return;
  // Schema lama: PIN | Keterangan | Berlaku Hingga | Status | Dibuat | Terakhir Digunakan
  if (String(header[1]).trim() === 'Keterangan') {
    sheet.insertColumnAfter(1);
    sheet.getRange(1, 2).setValue('Role');
    var n = sheet.getLastRow() - 1;
    if (n > 0) {
      // Default semua PIN lama → ADMIN (satu-satunya PIN lama adalah PIN admin default)
      var roles = [];
      for (var i = 0; i < n; i++) roles.push(['ADMIN']);
      sheet.getRange(2, 2, n, 1).setValues(roles);
    }
  }
}

// Ubah array baris peserta jadi objek
function rowToPeserta(r) {
  return {
    nomorUrut: r[0], kategori: r[1], golongan: r[2], kontingen: r[3],
    namaPeserta: r[4], timestamp: r[5]
  };
}

function rowToNilai(r) {
  var o = {
    idPenilaian: r[0], nomorUrut: r[1], kategori: r[2], golongan: r[3], kontingen: r[4],
    namaPeserta: r[5], juri: r[6], namaJuri: r[7], waktu: r[8], keluarGelanggang: r[9],
    totalNilai: r[18], timestamp: r[19]
  };
  for (var i = 0; i < KRITERIA_KEYS.length; i++) o[KRITERIA_KEYS[i]] = r[10 + i];
  return o;
}

/* ====================== KONTINGEN: GET ====================== */
function getKontingen() {
  var sh = getSheet(SHEETS.KONTINGEN);
  var data = sh.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    var nama = String(data[i][0]).trim();
    var kode = String(data[i][1]).trim();
    if (nama) list.push({ nama: nama, kode: kode || nama.substring(0, 3).toUpperCase() });
  }
  return list;
}

/* ====================== PESERTA: GET ====================== */
function getAll() {
  var sh = getSheet(SHEETS.PESERTA);
  var data = sh.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === '' && data[i][4] === '') continue;
    list.push(rowToPeserta(data[i]));
  }
  return list;
}

function getByKontingen(kontingen) {
  return getAll().filter(function (p) { return p.kontingen === kontingen; });
}

// kode kontingen = ambil dari sheet Kontingen; fallback 3 huruf kapital dari nama.
function kodeKontingen(nama) {
  if (!nama) return 'XXX';
  var list = getKontingen();
  for (var i = 0; i < list.length; i++) {
    if (list[i].nama === nama && list[i].kode) return String(list[i].kode).toUpperCase();
  }
  var clean = String(nama).replace(/[^A-Za-z0-9]/g, '');
  return (clean.substring(0, 3) || 'XXX').toUpperCase();
}

function getNextId(kontingen, golongan, kategori) {
  var kk = kodeKontingen(kontingen);
  var kg = KODE_GOLONGAN[golongan] || 'XXX';
  var kt = KODE_KATEGORI[kategori] || 'XXX';
  var prefix = kk + '-' + kg + '-' + kt + '-';
  var all = getAll();
  var maxN = 0;
  all.forEach(function (p) {
    if (String(p.nomorUrut).indexOf(prefix) === 0) {
      var n = parseInt(String(p.nomorUrut).split('-').pop(), 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    }
  });
  var next = maxN + 1;
  return prefix + ('00' + next).slice(-3);
}

/* ====================== PESERTA: POST ====================== */
function addPeserta(b) {
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    var sh = getSheet(SHEETS.PESERTA);
    var nomorUrut = getNextId(b.kontingen, b.golongan, b.kategori);
    sh.appendRow([nomorUrut, b.kategori, b.golongan, b.kontingen,
      b.namaPeserta, new Date().toISOString()]);
    return ok({ nomorUrut: nomorUrut });
  } finally { lock.releaseLock(); }
}

function findRow(sh, colIndex, value) {
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][colIndex]).trim() === String(value).trim()) return i + 1; // 1-based row
  }
  return -1;
}

function updatePeserta(b) {
  var sh = getSheet(SHEETS.PESERTA);
  var row = findRow(sh, 0, b.nomorUrut);
  if (row < 0) return err('Peserta tidak ditemukan.');
  sh.getRange(row, 2, 1, 4).setValues([[b.kategori, b.golongan, b.kontingen, b.namaPeserta]]);
  return ok();
}

function deletePeserta(b) {
  var sh = getSheet(SHEETS.PESERTA);
  var row = findRow(sh, 0, b.nomorUrut);
  if (row < 0) return err('Peserta tidak ditemukan.');
  sh.deleteRow(row);
  return ok();
}

/* ====================== PENILAIAN: GET ====================== */
function getNilaiByPeserta(nomorUrut) {
  var sh = getSheet(SHEETS.PENILAIAN);
  var data = sh.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(nomorUrut).trim()) list.push(rowToNilai(data[i]));
  }
  return list;
}

function getAllNilai() {
  var sh = getSheet(SHEETS.PENILAIAN);
  var data = sh.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === '') continue;
    list.push(rowToNilai(data[i]));
  }
  return list;
}

/* ====================== PENILAIAN: POST ====================== */
function juriCode(juri) {
  // "Juri 3" -> "JURI3"
  return String(juri).toUpperCase().replace(/\s+/g, '');
}

function addNilai(b) {
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    var sh = getSheet(SHEETS.PENILAIAN);
    // cek duplikasi juri+peserta
    var existing = getNilaiByPeserta(b.nomorUrut);
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].juri === b.juri) return err('Juri ini sudah menilai peserta tersebut.');
    }
    var id = 'NLP-' + b.nomorUrut + '-' + juriCode(b.juri);
    var nilai = b.nilai || {};
    var row = [id, b.nomorUrut, b.kategori, b.golongan, b.kontingen, b.namaPeserta,
      b.juri, b.namaJuri || '', b.waktu || 0, b.keluarGelanggang || 0];
    for (var k = 0; k < KRITERIA_KEYS.length; k++) {
      row.push(nilai[KRITERIA_KEYS[k]] != null ? nilai[KRITERIA_KEYS[k]] : '');
    }
    row.push(b.totalNilai != null ? b.totalNilai : 0);
    row.push(new Date().toISOString());
    sh.appendRow(row);
    return ok({ idPenilaian: id });
  } finally { lock.releaseLock(); }
}

function editNilai(b) {
  var sh = getSheet(SHEETS.PENILAIAN);
  var row = findRow(sh, 0, b.idPenilaian);
  if (row < 0) return err('Data penilaian tidak ditemukan.');
  var nilai = b.nilai || {};
  // update kolom kriteria (kolom 11–18)
  var vals = [];
  for (var k = 0; k < KRITERIA_KEYS.length; k++) {
    var cur = sh.getRange(row, 11 + k).getValue();
    vals.push(nilai[KRITERIA_KEYS[k]] != null ? nilai[KRITERIA_KEYS[k]] : cur);
  }
  sh.getRange(row, 11, 1, KRITERIA_KEYS.length).setValues([vals]);
  // kolom 9: Waktu (detik), kolom 10: Keluar Gelanggang — opsional
  if (b.waktu != null) sh.getRange(row, 9).setValue(b.waktu);
  if (b.keluarGelanggang != null) sh.getRange(row, 10).setValue(b.keluarGelanggang);
  if (b.totalNilai != null) sh.getRange(row, 19).setValue(b.totalNilai);
  return ok();
}

function deleteNilai(b) {
  var sh = getSheet(SHEETS.PENILAIAN);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === String(b.nomorUrut).trim() &&
        String(data[i][6]).trim() === String(b.juri).trim()) {
      sh.deleteRow(i + 1);
      return ok();
    }
  }
  return err('Nilai tidak ditemukan.');
}

/* ====================== REKAP ====================== */
function getRekap() {
  var nilai = getAllNilai();
  // kelompokkan per nomorUrut
  var grup = {};
  nilai.forEach(function (n) {
    (grup[n.nomorUrut] = grup[n.nomorUrut] || []).push(n);
  });

  var hasil = [];
  Object.keys(grup).forEach(function (nomorUrut) {
    var arr = grup[nomorUrut];
    var first = arr[0];
    var totals = arr.map(function (n) { return Number(n.totalNilai) || 0; });
    var jumlahJuri = arr.length;

    // nilai akhir: trimmed mean (sum - max - min) jika >=3 juri, else sum
    var sum = totals.reduce(function (a, b) { return a + b; }, 0);
    var tertinggi = Math.max.apply(null, totals);
    var terendah = Math.min.apply(null, totals);
    var nilaiAkhir = jumlahJuri >= 3 ? (sum - tertinggi - terendah) : sum;

    // orisinalitas trimmed: eliminasi orisinalitas dari juri dgn total tertinggi & terendah
    var orisinalitas = hitungOrisinalitasTrimmed(arr, totals, jumlahJuri);

    // map J1..J5 berdasarkan label juri (Juri 1..5)
    var row = {
      nomorUrut: nomorUrut,
      namaPeserta: first.namaPeserta,
      kontingen: first.kontingen,
      kategori: first.kategori,
      golongan: first.golongan,
      waktu: first.waktu,
      tertinggi: jumlahJuri >= 3 ? tertinggi : null,
      terendah: jumlahJuri >= 3 ? terendah : null,
      orisinalitas: orisinalitas,
      nilaiAkhir: nilaiAkhir,
      jumlahJuri: jumlahJuri
    };
    for (var n = 1; n <= 5; n++) { row['j' + n] = null; row['oris' + n] = null; }
    arr.forEach(function (it) {
      var m = String(it.juri).match(/(\d+)/);
      if (m) {
        row['j' + m[1]] = Number(it.totalNilai) || 0;
        row['oris' + m[1]] = Number(it.orisinalitas) || 0;
      }
    });

    hasil.push(row);
  });

  return hasil;
}

function hitungOrisinalitasTrimmed(arr, totals, jumlahJuri) {
  var oris = arr.map(function (n) { return Number(n.orisinalitas) || 0; });
  if (jumlahJuri < 3) {
    return oris.reduce(function (a, b) { return a + b; }, 0);
  }
  // index juri dengan total tertinggi & terendah
  var maxIdx = totals.indexOf(Math.max.apply(null, totals));
  var minIdx = totals.indexOf(Math.min.apply(null, totals));
  var sum = 0;
  for (var i = 0; i < oris.length; i++) {
    if (i === maxIdx || i === minIdx) continue;
    sum += oris[i];
  }
  return sum;
}

/* ====================== AKSES JURI / PIN ====================== */
function validatePin(pin) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var sheet = getSheet(SHEETS.AKSES);
    var data = sheet.getDataRange().getValues();
    var today = new Date();

    for (var i = 1; i < data.length; i++) {
      var rowPin = data[i][0];
      var role = data[i][1];
      var berlakuHingga = data[i][3];
      var status = data[i][4];
      if (String(rowPin).trim() !== String(pin).trim()) continue;
      if (status !== 'AKTIF') continue;
      if (berlakuHingga) {
        var expDate = new Date(berlakuHingga);
        if (!isNaN(expDate.getTime()) && today > expDate) continue;
      }
      // PIN valid — generate token & catat penggunaan
      var token = Utilities.getUuid().replace(/-/g, '');
      var expiredAt = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24 jam
      sheet.getRange(i + 1, 7).setValue(new Date().toISOString()); // kolom G: Terakhir Digunakan
      return { success: true, token: token, role: String(role || 'JURI').toUpperCase(), expiredAt: expiredAt };
    }
    return { success: false, message: 'PIN tidak valid atau sudah kadaluarsa.' };
  } finally {
    lock.releaseLock();
  }
}

// Generate PIN baru dengan Role=JURI (dipanggil Admin).
function generatePinJuri(keterangan, berlakuHingga) {
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var sheet = getSheet(SHEETS.AKSES);
    var data = sheet.getDataRange().getValues();
    var existing = {};
    for (var i = 1; i < data.length; i++) existing[String(data[i][0]).trim()] = true;

    var pin;
    do { pin = String(Math.floor(100000 + Math.random() * 900000)); } while (existing[pin]);

    sheet.appendRow([pin, 'JURI', keterangan || '', berlakuHingga || '', 'AKTIF', new Date().toISOString(), '']);
    return ok({ pin: pin });
  } finally { lock.releaseLock(); }
}

function revokePin(pin) {
  var sheet = getSheet(SHEETS.AKSES);
  var row = findRow(sheet, 0, pin);
  if (row < 0) return err('PIN tidak ditemukan.');
  sheet.getRange(row, 5).setValue('NONAKTIF'); // kolom E: Status
  return ok({ message: 'PIN berhasil dinonaktifkan.' });
}

// Daftar PIN Role=JURI (untuk panel Admin). PIN Admin tidak ditampilkan.
function getPinList() {
  var sheet = getSheet(SHEETS.AKSES);
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    var role = String(data[i][1] || '').toUpperCase();
    if (role !== 'JURI') continue;
    list.push({
      pin: String(data[i][0]),
      role: role,
      keterangan: data[i][2],
      berlakuHingga: data[i][3],
      status: data[i][4],
      dibuat: data[i][5],
      terakhirDigunakan: data[i][6]
    });
  }
  return list;
}

/* ====================== GELANGGANG ====================== */
function getGelanggang() {
  var sh = getSheet(SHEETS.GELANGGANG);
  var data = sh.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][0]).trim();
    if (!id) continue;
    list.push({ id: id, nama: data[i][1], status: data[i][2] || 'AKTIF' });
  }
  return list;
}

function addGelanggang(b) {
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    var sh = getSheet(SHEETS.GELANGGANG);
    var data = sh.getDataRange().getValues();
    // Generate ID: GEL-A, GEL-B, ... GEL-Z, lalu GEL-AA dst.
    var count = 0;
    for (var i = 1; i < data.length; i++) if (String(data[i][0]).trim()) count++;
    var id = 'GEL-' + nextLetterId(count);
    sh.appendRow([id, b.nama || ('Gelanggang ' + nextLetterId(count)), 'AKTIF']);
    return ok({ id: id });
  } finally { lock.releaseLock(); }
}

function nextLetterId(index) {
  // 0->A, 25->Z, 26->AA ...
  var s = '';
  index = index + 1; // 1-based
  while (index > 0) {
    var rem = (index - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    index = Math.floor((index - 1) / 26);
  }
  return s;
}

/* ====================== ANTRIAN AKTIF ====================== */
function rowToAntrian(r) {
  return {
    idAntrian: r[0], idGelanggang: r[1], nomorUrut: r[2],
    urutan: r[3], status: r[4], timestampMulai: r[5]
  };
}

// Gabungkan data antrian dengan data peserta.
function enrichAntrian(a) {
  var p = getAll().filter(function (x) { return String(x.nomorUrut).trim() === String(a.nomorUrut).trim(); })[0];
  if (p) {
    a.namaPeserta = p.namaPeserta;
    a.kategori = p.kategori;
    a.golongan = p.golongan;
    a.kontingen = p.kontingen;
  }
  return a;
}

function getAntrianByGelanggang(idGelanggang) {
  var sh = getSheet(SHEETS.ANTRIAN);
  var data = sh.getDataRange().getValues();
  var pesertaAll = getAll();
  var pesertaMap = {};
  pesertaAll.forEach(function (p) { pesertaMap[String(p.nomorUrut).trim()] = p; });

  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() !== String(idGelanggang).trim()) continue;
    var a = rowToAntrian(data[i]);
    var p = pesertaMap[String(a.nomorUrut).trim()];
    if (p) { a.namaPeserta = p.namaPeserta; a.kategori = p.kategori; a.golongan = p.golongan; a.kontingen = p.kontingen; }
    list.push(a);
  }
  list.sort(function (x, y) { return (Number(x.urutan) || 0) - (Number(y.urutan) || 0); });
  return list;
}

function getPesertaAktif(idGelanggang) {
  var list = getAntrianByGelanggang(idGelanggang);
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].status).trim() === 'TAMPIL') return list[i];
  }
  return null;
}

function addAntrian(b) {
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    var sh = getSheet(SHEETS.ANTRIAN);
    var data = sh.getDataRange().getValues();
    var maxId = 0;
    var maxUrutan = 0;
    for (var i = 1; i < data.length; i++) {
      var n = parseInt(data[i][0], 10);
      if (!isNaN(n) && n > maxId) maxId = n;
      if (String(data[i][1]).trim() === String(b.idGelanggang).trim()) {
        // Cegah duplikat peserta dalam satu gelanggang
        if (String(data[i][2]).trim() === String(b.nomorUrut).trim() &&
            String(data[i][4]).trim() !== 'SELESAI') {
          return err('Peserta sudah ada dalam antrian gelanggang ini.');
        }
        var u = parseInt(data[i][3], 10);
        if (!isNaN(u) && u > maxUrutan) maxUrutan = u;
      }
    }
    var idAntrian = maxId + 1;
    var urutan = maxUrutan + 1;
    sh.appendRow([idAntrian, b.idGelanggang, b.nomorUrut, urutan, 'MENUNGGU', '']);
    return ok({ idAntrian: idAntrian, urutan: urutan });
  } finally { lock.releaseLock(); }
}

function mulaiTampil(b) {
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    var sh = getSheet(SHEETS.ANTRIAN);
    var row = findRow(sh, 0, b.idAntrian);
    if (row < 0) return err('Antrian tidak ditemukan.');
    var idGelanggang = sh.getRange(row, 2).getValue();
    // Pastikan tidak ada peserta lain yang sedang TAMPIL di gelanggang ini.
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() === String(idGelanggang).trim() &&
          String(data[i][4]).trim() === 'TAMPIL' &&
          String(data[i][0]).trim() !== String(b.idAntrian).trim()) {
        return err('Masih ada peserta yang sedang tampil. Klik "Selesai" dahulu.');
      }
    }
    sh.getRange(row, 5).setValue('TAMPIL');
    sh.getRange(row, 6).setValue(new Date().toISOString());
    return ok();
  } finally { lock.releaseLock(); }
}

function selesaiTampil(b) {
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    var sh = getSheet(SHEETS.ANTRIAN);
    var row = findRow(sh, 0, b.idAntrian);
    if (row < 0) return err('Antrian tidak ditemukan.');
    var idGelanggang = sh.getRange(row, 2).getValue();
    sh.getRange(row, 5).setValue('SELESAI');

    // Aktifkan peserta berikutnya (status MENUNGGU dengan urutan terkecil)
    var data = sh.getDataRange().getValues();
    var nextRow = -1, nextUrutan = Infinity;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][1]).trim() === String(idGelanggang).trim() &&
          String(data[i][4]).trim() === 'MENUNGGU') {
        var u = parseInt(data[i][3], 10) || 0;
        if (u < nextUrutan) { nextUrutan = u; nextRow = i + 1; }
      }
    }
    var nextId = null;
    if (nextRow > 0) {
      sh.getRange(nextRow, 5).setValue('TAMPIL');
      sh.getRange(nextRow, 6).setValue(new Date().toISOString());
      nextId = sh.getRange(nextRow, 1).getValue();
    }
    return ok({ nextIdAntrian: nextId });
  } finally { lock.releaseLock(); }
}

function hapusAntrian(b) {
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    var sh = getSheet(SHEETS.ANTRIAN);
    var row = findRow(sh, 0, b.idAntrian);
    if (row < 0) return err('Antrian tidak ditemukan.');
    var idGelanggang = sh.getRange(row, 2).getValue();
    sh.deleteRow(row);
    return ok();
  } finally { lock.releaseLock(); }
}

// Geser urutan peserta dalam antrian (hanya antar peserta berstatus MENUNGGU).
// body: { idAntrian, direction: 'up' | 'down' }
function moveAntrian(b) {
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    var sh = getSheet(SHEETS.ANTRIAN);
    var data = sh.getDataRange().getValues();

    // Cari baris target & gelanggangnya
    var idGelanggang = null;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(b.idAntrian).trim()) {
        idGelanggang = String(data[i][1]).trim();
        if (String(data[i][4]).trim() !== 'MENUNGGU') {
          return err('Hanya peserta yang masih menunggu yang bisa diatur urutannya.');
        }
        break;
      }
    }
    if (idGelanggang === null) return err('Antrian tidak ditemukan.');

    // Kumpulkan baris MENUNGGU di gelanggang ini, urut berdasarkan kolom Urutan
    var menunggu = [];
    for (var j = 1; j < data.length; j++) {
      if (String(data[j][1]).trim() === idGelanggang &&
          String(data[j][4]).trim() === 'MENUNGGU') {
        menunggu.push({ row: j + 1, urutan: Number(data[j][3]) || 0, id: String(data[j][0]).trim() });
      }
    }
    menunggu.sort(function (x, y) { return x.urutan - y.urutan; });

    var pos = -1;
    for (var k = 0; k < menunggu.length; k++) {
      if (menunggu[k].id === String(b.idAntrian).trim()) { pos = k; break; }
    }
    if (pos < 0) return err('Antrian tidak ditemukan dalam daftar menunggu.');

    var swapWith = b.direction === 'up' ? pos - 1 : pos + 1;
    if (swapWith < 0 || swapWith >= menunggu.length) {
      return ok({ moved: false }); // sudah di ujung, tidak ada perubahan
    }

    // Tukar nilai Urutan (kolom 4) antara dua baris
    var a = menunggu[pos], c = menunggu[swapWith];
    sh.getRange(a.row, 4).setValue(c.urutan);
    sh.getRange(c.row, 4).setValue(a.urutan);
    return ok({ moved: true });
  } finally { lock.releaseLock(); }
}
```

### `manifest.json`

```json
{
  "name": "Pasanggiri Persinas ASAD",
  "short_name": "Pasanggiri",
  "description": "Sistem Pendaftaran & Penilaian Pasanggiri Pencak Silat Persinas ASAD",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#FFF8F0",
  "theme_color": "#1B4332",
  "lang": "id",
  "categories": ["sports", "productivity"],
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

### `service-worker.js`

```js
/* ==========================================================================
 * service-worker.js — PWA cache untuk Pasanggiri Persinas ASAD
 * --------------------------------------------------------------------------
 * Strategi:
 *  - App shell (HTML/CSS/JS/ikon): cache-first (cepat & bisa offline)
 *  - Permintaan ke Apps Script (data): network-only (selalu data terbaru)
 *  - Naikkan CACHE_VERSION setiap kali file app shell berubah.
 * ========================================================================== */

const CACHE_VERSION = 'pasanggiri-v9';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './config.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

// Install: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

// Activate: hapus cache lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Hanya tangani GET
  if (req.method !== 'GET') return;

  // Data dari Apps Script / API eksternal: network-only (jangan di-cache)
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    return; // biarkan browser menangani (network)
  }

  // Pusher: jangan cache (biarkan network langsung)
  if (url.hostname.includes('pusher.com') || url.hostname.includes('pusherapp.com')) {
    return;
  }

  // Font Google: cache-first
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('cdn-uicons.flaticon.com')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // App shell & aset lokal: cache-first dengan fallback network
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
  }
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type === 'basic') {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(req, res.clone());
    }
    return res;
  } catch (e) {
    // fallback ke index untuk navigasi offline
    if (req.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    throw e;
  }
}
```


---

## Struktur File

```
/
├── index.html
├── style.css
├── app.js
├── config.js
├── manifest.json
├── service-worker.js
├── peraturan-pasanggiri.pdf
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   └── icon-maskable-512.png
├── tools/
│   ├── gen_icons.py
│   ├── gen_pdf.py
│   └── gen_prompt.py
└── apps-script/
    └── Code.gs
```

> Generate ikon PWA: `python3 tools/gen_icons.py`
> Generate PDF placeholder: `python3 tools/gen_pdf.py`
> Regenerate prompt ini: `python3 tools/gen_prompt.py`
