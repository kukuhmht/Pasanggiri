import { getAdminClient } from '@/lib/auth'
import { NextResponse } from 'next/server'

// Core logic shared by GET (Vercel Cron) and POST invocations.
async function handleUpdateExpiredOrgs(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: expiredOrgs, error } = await db
    .from('organizations')
    .select('id, nama, status')
    .lt('berlaku_hingga', today)
    .in('status', ['trial', 'active'])

  if (error) {
    console.error('Error fetching expired orgs:', error)
    return NextResponse.json({ error: 'Failed to fetch orgs' }, { status: 500 })
  }

  if (!expiredOrgs || expiredOrgs.length === 0) {
    return NextResponse.json({ message: 'No organizations to update.' })
  }

  const updates = expiredOrgs.map(org => {
    return db.from('organizations').update({ status: 'expired' }).eq('id', org.id)
  })

  const results = await Promise.all(updates)
  const failedUpdates = results.filter(res => res.error)

  if (failedUpdates.length > 0) {
    console.error('Failed to update some orgs:', failedUpdates)
    return NextResponse.json({ 
        message: `Updated ${expiredOrgs.length - failedUpdates.length} orgs, but ${failedUpdates.length} updates failed.`,
        failed: failedUpdates.map((res, i) => ({ org_id: expiredOrgs[i].id, error: res.error }))
    }, { status: 500 })
  }

  return NextResponse.json({ message: `Successfully updated ${expiredOrgs.length} organizations to expired status.` })
}

// Vercel Cron invokes via GET with Authorization: Bearer <CRON_SECRET>
export async function GET(request: Request) {
  return handleUpdateExpiredOrgs(request)
}

// POST /api/cron/update-expired-orgs
export async function POST(request: Request) {
  return handleUpdateExpiredOrgs(request)
}
