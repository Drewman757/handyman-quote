'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Copy, Check, X } from 'lucide-react'

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export function CreateContractorForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [tempPassword, setTempPassword] = useState('')
  const [subscriptionStatus, setSubscriptionStatus] = useState('comp')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ email: string; tempPassword: string } | null>(null)
  const [copied, setCopied] = useState(false)

  function reset() {
    setEmail('')
    setBusinessName('')
    setOwnerName('')
    setTempPassword('')
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
        body: JSON.stringify({ email, businessName, ownerName, tempPassword, subscriptionStatus }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to create contractor')
        return
      }
      setResult({ email: data.email, tempPassword: data.tempPassword })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!result) return
    await navigator.clipboard.writeText(`Email: ${result.email}\nTemp password: ${result.tempPassword}`)
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
            Account created. Send these credentials to the contractor — they should sign in and change their password.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-sm space-y-1">
            <p><span className="text-gray-900">Email:</span> {result.email}</p>
            <p><span className="text-gray-900">Temp password:</span> {result.tempPassword}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy credentials'}
            </button>
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
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Temp password</label>
              <div className="flex gap-2">
                <input type="text" required minLength={6} value={tempPassword} onChange={e => setTempPassword(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]" />
                <button
                  type="button"
                  onClick={() => setTempPassword(generatePassword())}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition whitespace-nowrap"
                >
                  Generate
                </button>
              </div>
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
