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
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbx_vExpll5JTXBfHJAFDw45T6xQK7TwPrc5iSbxOO7sZa1HHPi1QBjy-1DM6Lw327x39A/exec',

  // ID Google Spreadsheet (lihat di URL spreadsheet)
  SPREADSHEET_ID: '1cHDPm3n3DJ6LbUxPNZFqyHCJ99UTuvyHmERO5zAXJL8',

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
