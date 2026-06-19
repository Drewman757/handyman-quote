'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, UserX, UserCheck, AlertTriangle } from 'lucide-react'

interface ContractorRow {
  id: string
  business_name: string
  owner_name: string
  email: string
  created_at: string
  is_suspended: boolean | null
  is_admin: boolean | null
  quoteCount: number
}

export function AdminTable({ rows, currentUserId }: { rows: ContractorRow[]; currentUserId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  async function toggleSuspend(contractorId: string, currentlySuspended: boolean) {
    setBusy(b => ({ ...b, [contractorId]: true }))
    try {
      await fetch('/api/admin/suspend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorId, suspend: !currentlySuspended }),
      })
      router.refresh()
    } finally {
      setBusy(b => ({ ...b, [contractorId]: false }))
    }
  }

  async function handleDelete(contractorId: string) {
    setBusy(b => ({ ...b, [contractorId]: true }))
    try {
      await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorId }),
      })
      setDeleteConfirm(null)
      router.refresh()
    } finally {
      setBusy(b => ({ ...b, [contractorId]: false }))
    }
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-16 text-center text-gray-400">
        No contractors found.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Contractor</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Quotes</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(c => {
              const isSelf = c.id === currentUserId
              const suspended = !!c.is_suspended
              const isConfirming = deleteConfirm === c.id
              const isBusy = !!busy[c.id]

              return (
                <tr key={c.id} className={suspended ? 'bg-red-50/40' : 'hover:bg-gray-50/50'}>
                  {/* Name */}
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-900 leading-snug">{c.business_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.owner_name}</p>
                    {c.is_admin && (
                      <span className="inline-block text-[10px] font-bold text-[#0E6E7E] uppercase tracking-wide mt-0.5">
                        Admin
                      </span>
                    )}
                  </td>

                  {/* Email */}
                  <td className="px-5 py-4 text-gray-600">{c.email}</td>

                  {/* Joined */}
                  <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                    {new Date(c.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </td>

                  {/* Quote count */}
                  <td className="px-5 py-4 text-right font-semibold text-gray-900">{c.quoteCount}</td>

                  {/* Status badge */}
                  <td className="px-5 py-4 text-center">
                    {suspended ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        Suspended
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        Active
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {isConfirming ? (
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span className="text-xs text-red-600 font-medium whitespace-nowrap">Delete all data?</span>
                          <button
                            onClick={() => handleDelete(c.id)}
                            disabled={isBusy}
                            className="text-xs px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:opacity-50 whitespace-nowrap"
                          >
                            {isBusy ? 'Deleting…' : 'Yes, delete'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="text-xs px-2.5 py-1 border border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Suspend / Reactivate — disabled for self */}
                          <button
                            onClick={() => !isSelf && toggleSuspend(c.id, suspended)}
                            disabled={isBusy || isSelf}
                            title={isSelf ? 'Cannot suspend yourself' : suspended ? 'Reactivate account' : 'Suspend account'}
                            className={`p-1.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${
                              suspended
                                ? 'text-green-600 hover:bg-green-50'
                                : 'text-amber-600 hover:bg-amber-50'
                            }`}
                          >
                            {suspended
                              ? <UserCheck className="w-4 h-4" />
                              : <UserX className="w-4 h-4" />
                            }
                          </button>

                          {/* Delete — disabled for self */}
                          <button
                            onClick={() => !isSelf && setDeleteConfirm(c.id)}
                            disabled={isBusy || isSelf}
                            title={isSelf ? 'Cannot delete yourself' : 'Delete contractor and all data'}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
