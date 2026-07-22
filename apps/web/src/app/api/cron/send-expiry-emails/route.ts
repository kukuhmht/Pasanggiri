import { getAdminClient } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// POST /api/cron/send-expiry-emails
export async function POST(request: Request) {
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
  const gracePeriodEndTomorrow = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const results = { reminderSent: 0, expiredSent: 0, finalWarningSent: 0, errors: [] as Array<{ org: string; email: string; error: string }> }

  const processOrgs = async (date: string, type: 'reminder' | 'expired' | 'finalWarning') => {
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
              : type === 'expired'
                ? '[Pasanggiri] Masa berlaku habis - Grace period 3 hari'
                : '[Pasanggiri] URGENT: Akun akan tersuspend besok',
            body: emailTemplates[type](org.nama, date),
          })
          if (type === 'reminder') results.reminderSent++
          else if (type === 'expired') results.expiredSent++
          else results.finalWarningSent++
        } catch (err) {
          results.errors.push({ org: org.nama, email, error: (err as Error).message })
        }
      }
    }
  }

  await processOrgs(tomorrow, 'reminder')
  await processOrgs(today, 'expired')
  await processOrgs(gracePeriodEndTomorrow, 'finalWarning')

  return NextResponse.json(results)
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

const emailTemplates: Record<'reminder' | 'expired' | 'finalWarning', (orgNama: string, tgl: string) => string> = {
  reminder: (orgNama, tgl) => `<h2>Reminder: Masa Berlaku Akun Akan Berakhir</h2><p>Halo tim <strong>${orgNama}</strong>,</p><p>Masa berlaku akun Pasanggiri Anda akan berakhir besok (<strong>${tgl}</strong>).</p><p>Anda masih dapat menggunakan layanan selama <strong>3 hari</strong> (grace period) sebelum akun tersuspend.</p><p><a href="https://pasanggiri.web.id/app">Login ke dashboard</a> untuk perpanjang.</p>`,
  expired: (orgNama, tgl) => `<h2>Masa Berlaku Habis</h2><p>Halo tim <strong>${orgNama}</strong>,</p><p>Masa berlaku akun Pasanggiri Anda telah berakhir pada <strong>${tgl}</strong>.</p><p>Grace period <strong>3 hari</strong> dimulai. Setelah itu, akses akan tersuspend.</p>`,
  finalWarning: (orgNama, tgl) => `<h2>URGENT: Akun Akan Tersuspend Besok</h2><p>Halo tim <strong>${orgNama}</strong>,</p><p>Grace period akun Anda berakhir <strong>besok</strong>. Akses akan tersuspend dan Anda tidak dapat mengakses dashboard.</p><p><a href="https://pasanggiri.web.id/app">Perpanjang Sekarang</a></p>`,
}

