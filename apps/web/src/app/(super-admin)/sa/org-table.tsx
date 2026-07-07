'use client'

import { useState } from 'react'

type Org = {
  id: string
  nama: string
  slug: string
  status: string
  berlaku_hingga: string | null
  created_at: string
}

export function OrgTable({ orgs: initial }: { orgs: Org[] }) {
  const [orgs, setOrgs] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [dateValue, setDateValue] = useState('')

  async function updateOrg(orgId: string, payload: { status?: string; berlaku_hingga?: string | null }) {
    setLoading(orgId)
    const res = await fetch('/api/sa/org-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, ...payload })
    })
    if (res.ok) {
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, ...payload } : o))
    }
    setLoading(null)
  }

  function startEditDate(org: Org) {
    setEditingDate(org.id)
    setDateValue(org.berlaku_hingga || '')
  }

  function saveDate(orgId: string) {
    updateOrg(orgId, { berlaku_hingga: dateValue || null })
    setEditingDate(null)
  }

  return (
    <div className="space-y-3">
      {orgs.length === 0 ? (
        <p className="py-8 text-center text-gray-400">Belum ada organisasi.</p>
      ) : (
        orgs.map(org => (
          <div key={org.id} className="rounded-xl bg-white p-4 shadow">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-800">{org.nama}</h3>
                  <StatusBadge status={org.status} />
                </div>
                <p className="mt-0.5 text-xs text-gray-400">
                  slug: {org.slug} · dibuat: {new Date(org.created_at).toLocaleDateString('id-ID')}
                </p>

                {/* Berlaku hingga */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Berlaku s/d:</span>
                  {editingDate === org.id ? (
                    <div className="flex items-center gap-1">
                      <input type="date" value={dateValue} onChange={e => setDateValue(e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs" />
                      <button onClick={() => saveDate(org.id)}
                        className="rounded bg-hijau-tua px-2 py-1 text-[10px] font-bold text-white">Simpan</button>
                      <button onClick={() => setEditingDate(null)}
                        className="text-[10px] text-gray-500 hover:underline">Batal</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium text-gray-700">
                        {org.berlaku_hingga || '∞ (tanpa batas)'}
                      </span>
                      <button onClick={() => startEditDate(org)}
                        className="text-[10px] text-hijau-sedang hover:underline">Edit</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-1.5">
                {org.status !== 'active' && (
                  <button
                    onClick={() => updateOrg(org.id, { status: 'active' })}
                    disabled={loading === org.id}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Aktifkan
                  </button>
                )}
                {org.status !== 'suspended' && (
                  <button
                    onClick={() => updateOrg(org.id, { status: 'suspended' })}
                    disabled={loading === org.id}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Suspend
                  </button>
                )}
                {org.status !== 'trial' && (
                  <button
                    onClick={() => updateOrg(org.id, { status: 'trial' })}
                    disabled={loading === org.id}
                    className="rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-yellow-600 disabled:opacity-50"
                  >
                    Trial
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    trial: 'bg-yellow-100 text-yellow-800',
    suspended: 'bg-red-100 text-red-800',
    expired: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${colors[status] || colors.expired}`}>
      {status.toUpperCase()}
    </span>
  )
}
