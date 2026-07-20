'use client'

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, UserX, UserCheck, AlertTriangle, Mail, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/pricing'

interface QuoteSummary {
  id: string
  status: string
  total: number
  created_at: string
  is_paid: boolean
  client_name: string
}

interface ContractorRow {
  id: string
  business_name: string
  owner_name: string
  email: string
  created_at: string
  is_suspended: boolean | null
  is_admin: boolean | null
  subscription_status: string | null
  quoteCount: number
  quotes: QuoteSummary[]
}

export function AdminTable({ rows, currentUserId }: { rows: ContractorRow[]; currentUserId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [emailBusy, setEmailBusy] = useState<Record<string, boolean>>({})
  const [emailSent, setEmailSent] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<string | null>(null)

  async function handleSendUpgradeEmail(contractorId: string) {
    setEmailBusy(b => ({ ...b, [contractorId]: true }))
    try {
      const res = await fetch('/api/admin/send-upgrade-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorId }),
      })
      if (res.ok) {
        setEmailSent(s => ({ ...s, [contractorId]: true }))
        setTimeout(() => setEmailSent(s => ({ ...s, [contractorId]: false })), 2000)
      }
    } finally {
      setEmailBusy(b => ({ ...b, [contractorId]: false }))
    }
  }

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
      <div className="hidden sm:block overflow-x-auto">
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
                <Fragment key={c.id}>
                <tr className={suspended ? 'bg-red-50/40' : 'hover:bg-gray-50/50'}>
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
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                      className="inline-flex items-center gap-1 font-semibold text-gray-900 hover:text-[#0E6E7E] transition"
                    >
                      {c.quoteCount}
                      {expanded === c.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </td>

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
                    <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">
                      {c.subscription_status || '—'}
                    </p>
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
                          {/* Send upgrade email — works regardless of trial/suspension state */}
                          <button
                            onClick={() => handleSendUpgradeEmail(c.id)}
                            disabled={emailBusy[c.id]}
                            title={emailSent[c.id] ? 'Sent!' : 'Send upgrade email'}
                            className="flex items-center gap-1.5 px-2.5 py-1 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 whitespace-nowrap"
                          >
                            {emailSent[c.id]
                              ? <Check className="w-3.5 h-3.5 text-green-600" />
                              : <Mail className="w-3.5 h-3.5" />
                            }
                            {emailBusy[c.id] ? 'Sending…' : emailSent[c.id] ? 'Sent!' : 'Send email'}
                          </button>

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
                {expanded === c.id && (
                  <tr>
                    <td colSpan={6} className="px-5 py-4 bg-gray-50 border-t border-b border-gray-100">
                      {c.quotes.length === 0 ? (
                        <p className="text-xs text-gray-400">No quotes yet.</p>
                      ) : (
                        <div className="grid grid-cols-[1fr,auto,auto,auto,auto] gap-x-6 gap-y-1.5 text-xs items-center">
                          <div className="text-gray-400 font-semibold uppercase text-[10px] tracking-wide">Client</div>
                          <div className="text-gray-400 font-semibold uppercase text-[10px] tracking-wide">Date</div>
                          <div className="text-gray-400 font-semibold uppercase text-[10px] tracking-wide">Status</div>
                          <div className="text-gray-400 font-semibold uppercase text-[10px] tracking-wide">Paid</div>
                          <div className="text-gray-400 font-semibold uppercase text-[10px] tracking-wide text-right">Total</div>
                          {c.quotes.map(q => (
                            <Fragment key={q.id}>
                              <div className="text-gray-700 truncate max-w-[220px]">{q.client_name}</div>
                              <div className="text-gray-500 whitespace-nowrap">
                                {new Date(q.created_at).toLocaleDateString('en-US', {
                                  month: 'short', day: 'numeric', year: 'numeric',
                                })}
                              </div>
                              <div className="text-gray-600 capitalize">{q.status}</div>
                              <div>
                                {q.is_paid ? (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700">Paid</span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </div>
                              <div className="text-gray-900 font-semibold text-right">{formatCurrency(q.total)}</div>
                            </Fragment>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden divide-y divide-gray-100">
        {rows.map(c => {
          const isSelf = c.id === currentUserId
          const suspended = !!c.is_suspended
          const isConfirming = deleteConfirm === c.id
          const isBusy = !!busy[c.id]

          return (
            <div key={c.id} className={`p-4 space-y-3 ${suspended ? 'bg-red-50/40' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 leading-snug truncate">{c.business_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{c.owner_name}</p>
                  {c.is_admin && (
                    <span className="inline-block text-[10px] font-bold text-[#0E6E7E] uppercase tracking-wide mt-0.5">
                      Admin
                    </span>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {suspended ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      Suspended
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      Active
                    </span>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">
                    {c.subscription_status || '—'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div className="col-span-2 min-w-0">
                  <span className="text-gray-400">Email </span>
                  <span className="text-gray-600 break-all">{c.email}</span>
                </div>
                <div>
                  <span className="text-gray-400">Joined </span>
                  <span className="text-gray-500">
                    {new Date(c.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Quotes </span>
                  <button
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    className="inline-flex items-center gap-1 font-semibold text-gray-900"
                  >
                    {c.quoteCount}
                    {expanded === c.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {expanded === c.id && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                  {c.quotes.length === 0 ? (
                    <p className="text-xs text-gray-400">No quotes yet.</p>
                  ) : (
                    c.quotes.map(q => (
                      <div key={q.id} className="flex items-center justify-between text-xs border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-gray-700 font-medium truncate">{q.client_name}</p>
                          <p className="text-gray-400">
                            {new Date(q.created_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })} &middot; <span className="capitalize">{q.status}</span>
                            {q.is_paid && (
                              <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-700 align-middle">Paid</span>
                            )}
                          </p>
                        </div>
                        <span className="font-semibold text-gray-900 shrink-0 ml-2">{formatCurrency(q.total)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {isConfirming ? (
                <div className="flex items-center gap-2 pt-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span className="text-xs text-red-600 font-medium flex-1">Delete all data?</span>
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
                <div className="space-y-2 pt-1">
                  {/* Send upgrade email — works regardless of trial/suspension state */}
                  <button
                    onClick={() => handleSendUpgradeEmail(c.id)}
                    disabled={emailBusy[c.id]}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 transition disabled:opacity-50"
                  >
                    {emailSent[c.id]
                      ? <Check className="w-3.5 h-3.5 text-green-600" />
                      : <Mail className="w-3.5 h-3.5" />
                    }
                    {emailBusy[c.id] ? 'Sending…' : emailSent[c.id] ? 'Sent!' : 'Send upgrade email'}
                  </button>

                  <div className="flex items-center gap-2">
                  {/* Suspend / Reactivate — disabled for self */}
                  <button
                    onClick={() => !isSelf && toggleSuspend(c.id, suspended)}
                    disabled={isBusy || isSelf}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                      suspended
                        ? 'text-green-600 border-green-200 hover:bg-green-50'
                        : 'text-amber-600 border-amber-200 hover:bg-amber-50'
                    }`}
                  >
                    {suspended
                      ? <UserCheck className="w-3.5 h-3.5" />
                      : <UserX className="w-3.5 h-3.5" />
                    }
                    {isSelf ? 'Cannot suspend self' : suspended ? 'Reactivate' : 'Suspend'}
                  </button>

                  {/* Delete — disabled for self */}
                  <button
                    onClick={() => !isSelf && setDeleteConfirm(c.id)}
                    disabled={isBusy || isSelf}
                    title={isSelf ? 'Cannot delete yourself' : 'Delete contractor and all data'}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 border border-red-200 hover:bg-red-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
