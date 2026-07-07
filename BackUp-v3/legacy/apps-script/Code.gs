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
var SPREADSHEET_ID = '1cHDPm3n3DJ6LbUxPNZFqyHCJ99UTuvyHmERO5zAXJL8';

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
