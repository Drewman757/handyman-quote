'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function UpdatePasswordPage() {
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError('')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="QuoteBuilder" className="w-14 h-14 mb-4 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">QuoteBuilder</h1>
          <p className="text-sm text-gray-500 mt-1">by Lineage Labs</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          {!ready ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#0E6E7E] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-5">Set your password</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] focus:border-transparent"
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] focus:border-transparent"
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Set password & continue'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
