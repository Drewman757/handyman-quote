'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function InviteConfirmForm() {
  const searchParams = useSearchParams()
  const tokenHash = searchParams.get('token_hash') || ''
  const type = searchParams.get('type') || 'recovery'
  const next = searchParams.get('next') || '/update-password'

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleContinue() {
    setLoading(true)
    setError('')
    try {
      const confirmUrl = `/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}&next=${encodeURIComponent(next)}`
      // Fetching (rather than navigating) lets us inspect where the redirect actually
      // landed before committing to a full page transition — /auth/confirm's logic is
      // untouched, we're just deferring when it gets hit until this real button click.
      const res = await fetch(confirmUrl, { redirect: 'follow', credentials: 'same-origin' })
      if (res.url.includes('/login')) {
        setError('This link has expired or was already used.')
        setLoading(false)
        return
      }
      window.location.href = next
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
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
          {error ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Link expired</h2>
              <p className="text-sm text-gray-600 mb-5">{error}</p>
              <Link
                href="/forgot-password"
                className="block w-full text-center bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-2.5 rounded-lg text-sm transition"
              >
                Request a new link
              </Link>
            </>
          ) : !tokenHash ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Link incomplete</h2>
              <p className="text-sm text-gray-600 mb-5">
                This link is missing information and can&apos;t be used.
              </p>
              <Link
                href="/forgot-password"
                className="block w-full text-center bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-2.5 rounded-lg text-sm transition"
              >
                Request a new link
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Activate your account</h2>
              <p className="text-sm text-gray-600 mb-5">
                Click below to verify your invite and set up your password.
              </p>
              <button
                onClick={handleContinue}
                disabled={loading}
                className="w-full bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Continue to set your password'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function InviteConfirmPage() {
  return (
    <Suspense fallback={null}>
      <InviteConfirmForm />
    </Suspense>
  )
}
