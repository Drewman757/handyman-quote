'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Copy, Check, X, AlertTriangle } from 'lucide-react'

export function CreateContractorForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [subscriptionStatus, setSubscriptionStatus] = useState('comp')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ email: string; warning?: string; inviteLink?: string } | null>(null)
  const [copied, setCopied] = useState(false)

  function reset() {
    setEmail('')
    setBusinessName('')
    setOwnerName('')
    setSubscriptionStatus('comp')
    setError('')
    setResult(null)
    setCopied(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/create-contractor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, businessName, ownerName, subscriptionStatus }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create contractor')
        return
      }
      setResult({ email: data.email, warning: data.warning, inviteLink: data.inviteLink })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!result?.inviteLink) return
    await navigator.clipboard.writeText(result.inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-[#0E6E7E] hover:bg-[#0A5560] text-white text-sm font-medium rounded-lg transition"
      >
        <UserPlus className="w-4 h-4" />
        Manually create contractor
      </button>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Manually create contractor</h2>
        <button
          onClick={() => { setOpen(false); reset() }}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Account created. An invite email was sent to <span className="font-medium text-gray-900">{result.email}</span> so
            they can set up their own password.
          </p>
          {result.warning && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">{result.warning}</p>
            </div>
          )}
          {result.inviteLink && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
              <p className="text-xs font-medium text-gray-700">Invite link (share manually)</p>
              <p className="font-mono text-xs text-[#1a1a1a] break-all">{result.inviteLink}</p>
            </div>
          )}
          <div className="flex gap-2">
            {result.inviteLink && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy invite link'}
              </button>
            )}
            <button
              onClick={() => { setOpen(false); reset() }}
              className="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Business name</label>
              <input type="text" required value={businessName} onChange={e => setBusinessName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contact name</label>
              <input type="text" required value={ownerName} onChange={e => setOwnerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Account type</label>
              <select value={subscriptionStatus} onChange={e => setSubscriptionStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]">
                <option value="comp">Comp</option>
                <option value="beta">Beta</option>
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50">
            {loading ? 'Creating…' : 'Create contractor'}
          </button>
        </form>
      )}
    </div>
  )
}
