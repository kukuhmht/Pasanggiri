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
