#!/usr/bin/env python3
"""Generate PROMPT-PasanggiriAsad-PWA.md with full spec + embedded source code."""
import os

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

# Read all source files
file_list = [
    ("config.js", "js"),
    ("index.html", "html"),
    ("style.css", "css"),
    ("app.js", "js"),
    ("apps-script/Code.gs", "js"),
    ("manifest.json", "json"),
    ("service-worker.js", "js"),
]

files = {}
for fname, _ in file_list:
    with open(fname, "r") as f:
        files[fname] = f.read()

# Replace credentials with placeholders
files["config.js"] = files["config.js"].replace(
    "AKfycbx_vExpll5JTXBfHJAFDw45T6xQK7TwPrc5iSbxOO7sZa1HHPi1QBjy-1DM6Lw327x39A",
    "GANTI_DENGAN_DEPLOY_ID",
).replace(
    "1cHDPm3n3DJ6LbUxPNZFqyHCJ99UTuvyHmERO5zAXJL8",
    "GANTI_DENGAN_ID_SPREADSHEET",
)
files["apps-script/Code.gs"] = files["apps-script/Code.gs"].replace(
    "1cHDPm3n3DJ6LbUxPNZFqyHCJ99UTuvyHmERO5zAXJL8",
    "GANTI_DENGAN_ID_SPREADSHEET",
)

HEADER = """# Prompt: Sistem Pendaftaran & Penilaian Pasanggiri (PWA)

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

"""

FOOTER = """
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
"""

with open("PROMPT-PasanggiriAsad-PWA.md", "w") as out:
    out.write(HEADER)
    for fname, ext in file_list:
        out.write(f"### `{fname}`\n\n")
        out.write(f"```{ext}\n")
        content = files[fname]
        out.write(content)
        if not content.endswith("\n"):
            out.write("\n")
        out.write("```\n\n")
    out.write(FOOTER)

size = os.path.getsize("PROMPT-PasanggiriAsad-PWA.md")
lines = sum(1 for _ in open("PROMPT-PasanggiriAsad-PWA.md"))
print(f"Done! {lines} lines, {size:,} bytes")
