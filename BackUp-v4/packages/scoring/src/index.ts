/**
 * @pasanggiri/scoring — Logika penilaian Pencak Silat Persinas ASAD
 * Digunakan di API routes (server-side) dan frontend (preview).
 */

export const WAKTU_BATAS_DEFAULT = 190  // 3:10 untuk PERORANGAN, BERKELOMPOK, MASSAL
export const WAKTU_BATAS_ATT = 300      // 5:00 untuk ATT
export const KEMANTAPAN_LOCK_VALUE = 20
export const BERPASANGAN_IDEAL = 120    // 2:00

export interface PenaltiRule {
  minSelisih: number
  maxSelisih: number
  potong: number
}

export const BERPASANGAN_PENALTI: PenaltiRule[] = [
  { minSelisih: 5, maxSelisih: 10, potong: 5 },
  { minSelisih: 11, maxSelisih: Infinity, potong: 15 },
]

export const KELUAR_GELANGGANG_POIN = 5

export interface NilaiInput {
  kategori: string
  nilai: Record<string, number>
  waktuDetik: number
  keluarGelanggang: number
}

export interface ScoreResult {
  base: number
  penalti: number
  total: number
  kemantapanLocked: boolean
}

/**
 * Hitung total skor termasuk penalti (server-side definitive).
 */
export function computeTotal(input: NilaiInput): ScoreResult {
  const { kategori, nilai, waktuDetik, keluarGelanggang } = input
  let kemantapanLocked = false

  // Clone nilai untuk modifikasi
  const val = { ...nilai }

  // Lock KEMANTAPAN jika waktu melewati batas (non-BERPASANGAN)
  if (kategori !== 'BERPASANGAN') {
    const batas = kategori === 'ATT' ? WAKTU_BATAS_ATT : WAKTU_BATAS_DEFAULT
    if (waktuDetik > batas) {
      val.kemantapan = KEMANTAPAN_LOCK_VALUE
      kemantapanLocked = true
    }
  }

  // Hitung base (sum semua kriteria)
  const base = Object.values(val).reduce((sum, v) => sum + (v || 0), 0)

  // Hitung penalti (hanya BERPASANGAN)
  let penalti = 0
  if (kategori === 'BERPASANGAN') {
    // Penalti waktu: HANYA jika > 2:00 (di bawah 2:00 = toleransi)
    if (waktuDetik > BERPASANGAN_IDEAL) {
      const selisih = waktuDetik - BERPASANGAN_IDEAL
      const rule = BERPASANGAN_PENALTI.find(r => selisih >= r.minSelisih && selisih <= r.maxSelisih)
      if (rule) penalti += rule.potong
    }
    // Penalti keluar gelanggang
    penalti += (keluarGelanggang || 0) * KELUAR_GELANGGANG_POIN
  }

  return { base, penalti, total: base - penalti, kemantapanLocked }
}

/**
 * Hitung nilai akhir trimmed-mean dari array total per juri.
 * ≥3 juri: buang tertinggi & terendah, lalu sum sisanya.
 * <3 juri: sum semua.
 */
export function nilaiAkhir(totals: number[]): {
  nilaiAkhir: number
  tertinggi: number | null
  terendah: number | null
} {
  if (totals.length === 0) return { nilaiAkhir: 0, tertinggi: null, terendah: null }

  const sum = totals.reduce((a, b) => a + b, 0)

  if (totals.length < 3) {
    return { nilaiAkhir: sum, tertinggi: null, terendah: null }
  }

  const tertinggi = Math.max(...totals)
  const terendah = Math.min(...totals)
  return {
    nilaiAkhir: sum - tertinggi - terendah,
    tertinggi,
    terendah,
  }
}
