'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function RequestAccessPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [agreedAt, setAgreedAt] = useState('')
  const [showTermsError, setShowTermsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!agreed) {
      setShowTermsError(true)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setError('')

    const form = e.currentTarget
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      company: (form.elements.namedItem('company') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      password,
      phone: (form.elements.namedItem('phone') as HTMLInputElement).value,
      description: (form.elements.namedItem('description') as HTMLTextAreaElement).value,
      agreedToTermsAt: agreedAt,
    }

    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const json = await res.json()

    if (!res.ok) {
      setError(json.error || 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    window.location.href = json.url
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="QuoteBuilder" className="w-14 h-14 mb-4 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">Get QuoteBuilder</h1>
          <p className="text-sm text-gray-500 mt-1">$50/month — cancel anytime</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
              <input
                name="name"
                type="text"
                required
                placeholder="John Smith"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company name</label>
              <input
                name="company"
                type="text"
                required
                placeholder="Smith Handyman Services"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                name="email"
                type="email"
                required
                placeholder="john@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Min 6 characters"
                autoComplete="new-password"
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter password"
                autoComplete="new-password"
                minLength={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                name="phone"
                type="tel"
                required
                placeholder="(555) 000-0000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tell us about your business
              </label>
              <textarea
                name="description"
                required
                rows={3}
                placeholder="What kind of work do you do? How many quotes do you send per month?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E] resize-none"
              />
            </div>

            {/* Terms agreement */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-3">
              <p className="text-xs text-gray-600 leading-relaxed">
                By signing up, you agree that Lineage Labs LLC may access, store, and use the information you enter into
                QuoteBuilder — including quote, job, and business data — to operate, maintain, support, and improve QuoteBuilder
                and Lineage Labs&rsquo; other products and services, including improving our AI features. You retain ownership of
                your business data. You&rsquo;re responsible for having the right to enter any client/customer information you
                input. We don&rsquo;t sell your data to third parties.
              </p>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => {
                    setAgreed(e.target.checked)
                    if (e.target.checked) setAgreedAt(new Date().toISOString())
                    if (e.target.checked) setShowTermsError(false)
                  }}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#0E6E7E] focus:ring-[#0E6E7E] flex-shrink-0"
                />
                <span className="text-xs text-gray-700 leading-relaxed">
                  I have read and agree to the Data Use Agreement,{' '}
                  <Link href="/terms" target="_blank" className="text-[#0E6E7E] hover:underline font-medium">
                    Terms of Service
                  </Link>
                  , and{' '}
                  <Link href="/privacy" target="_blank" className="text-[#0E6E7E] hover:underline font-medium">
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>
              {showTermsError && !agreed && (
                <p className="text-xs text-red-600">Please accept the Terms of Service and Privacy Policy to continue.</p>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div onClick={() => !agreed && setShowTermsError(true)}>
              <button
                type="submit"
                disabled={!agreed || loading}
                className="w-full bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Redirecting to checkout…' : 'Continue to payment →'}
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Secured by Stripe. You&apos;ll be charged $50/month after account approval.
        </p>
      </div>
    </div>
  )
}
