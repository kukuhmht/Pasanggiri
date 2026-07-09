import { getAuthContext, getAdminClient } from '@/lib/auth'
import * as xlsx from 'xlsx'

const KATEGORI = ['PERORANGAN', 'BERPASANGAN', 'BERKELOMPOK', 'MASSAL', 'ATT']
const GOLONGAN = ['Usia Dini', 'Pra Remaja', 'Remaja', 'Dewasa', 'Pembina', 'Istimewa', 'Campuran']

// GET /api/events/:id/peserta/template — download template Excel (admin only)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getAuthContext()
  if (!ctx) return new Response('Unauthorized', { status: 401 })

  const { id: eventId } = await params
  const db = getAdminClient()
  const { data: kontingens } = await db.from('kontingen').select('nama').eq('event_id', eventId)
  
  const ws = xlsx.utils.aoa_to_sheet([
    ['Kategori', 'Golongan', 'Kontingen', 'Anggota (dipisah koma)'],
    ['BERPASANGAN', 'Remaja', 'ASAD Bandung', 'Ahmad, Budi'],
  ])
  const ws_petunjuk = xlsx.utils.aoa_to_sheet([
    ['Kolom', 'Keterangan'],
    ['Kategori', `Wajib diisi salah satu dari: ${KATEGORI.join(', ')}`],
    ['Golongan', `Wajib diisi salah satu dari: ${GOLONGAN.join(', ')}`],
    ['Kontingen', 'Nama lengkap kontingen. Jika belum ada, akan dibuat otomatis.'],
    ['Anggota', 'Nama peserta. Pisahkan dengan koma untuk kategori lebih dari 1 orang.'],
    ['', ''],
    ['Kontingen Terdaftar', 'Nama Kontingen'],
    ...(kontingens || []).map(k => ['', k.nama])
  ])

  const wb = xlsx.utils.book_new()
  xlsx.utils.book_append_sheet(wb, ws, 'Template')
  xlsx.utils.book_append_sheet(wb, ws_petunjuk, 'Petunjuk Pengisian')

  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="template-peserta.xlsx"',
    },
  })
}
