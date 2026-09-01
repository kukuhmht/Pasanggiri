import { getAdminClient } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Core logic shared by GET (Vercel Cron) and POST invocations.
async function handleSendExpiryEmails(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminClient()
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const results = { reminderSent: 0, expiredSent: 0, errors: [] as Array<{ org: string; email: string; error: string }> }

  const processOrgs = async (date: string, type: 'reminder' | 'expired') => {
    const { data: orgs } = await db
      .from('organizations')
      .select('id, nama, memberships(user_id)')
      .eq('berlaku_hingga', date)
      .in('status', ['trial', 'active'])

    for (const org of orgs || []) {
      for (const m of org.memberships) {
        const { data } = await supabaseAdmin.auth.admin.getUserById(m.user_id)
        const email = data?.user?.email
        if (!email) continue
        try {
          await sendEmail({
            to: email,
            subject: type === 'reminder'
              ? '[Pasanggiri] Reminder: Akun akan berakhir besok'
              : '[Pasanggiri] Masa berlaku akun telah berakhir',
            body: emailTemplates[type](org.nama, date),
          })
          if (type === 'reminder') results.reminderSent++
          else results.expiredSent++
        } catch (err) {
          results.errors.push({ org: org.nama, email, error: (err as Error).message })
        }
      }
    }
  }

  await processOrgs(tomorrow, 'reminder')
  await processOrgs(today, 'expired')

  return NextResponse.json(results)
}

// Vercel Cron invokes via GET with Authorization: Bearer <CRON_SECRET>
export async function GET(request: Request) {
  return handleSendExpiryEmails(request)
}

// POST /api/cron/send-expiry-emails
export async function POST(request: Request) {
  return handleSendExpiryEmails(request)
}

async function sendEmail({ to, subject, body }: { to: string; subject: string; body: string }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Pasanggiri <noreply@pasanggiri.web.id>',
      to,
      subject,
      html: body,
    }),
  })
  if (!res.ok) throw new Error(await res.text())
}

const emailTemplates: Record<'reminder' | 'expired', (orgNama: string, tgl: string) => string> = {
  reminder: (orgNama, tgl) => `<h2>Reminder: Masa Berlaku Akun Akan Berakhir</h2><p>Halo tim <strong>${orgNama}</strong>,</p><p>Masa berlaku akun Pasanggiri Anda akan berakhir besok (<strong>${tgl}</strong>).</p><p>Setelah tanggal tersebut, akun Anda akan otomatis berstatus <strong>expired</strong> dan akses ke dashboard akan dinonaktifkan.</p><p>Silakan <a href="https://pasanggiri.web.id/app">login ke dashboard</a> dan perpanjang sebelum masa berlaku berakhir.</p>`,
  expired: (orgNama, tgl) => `<h2>Masa Berlaku Akun Telah Berakhir</h2><p>Halo tim <strong>${orgNama}</strong>,</p><p>Masa berlaku akun Pasanggiri Anda telah berakhir pada <strong>${tgl}</strong>.</p><p>Akun Anda kini berstatus <strong>expired</strong> dan akses ke dashboard telah dinonaktifkan.</p><p>Silakan <a href="https://pasanggiri.web.id/app">perpanjang akun Anda</a> untuk mengaktifkannya kembali.</p>`,
}

