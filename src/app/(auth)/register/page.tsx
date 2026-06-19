'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [agreedAt, setAgreedAt] = useState('')
  const [showTermsError, setShowTermsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()

    if (!agreed) {
      setShowTermsError(true)
      return
    }

    setLoading(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !data.user) {
      setError(signUpError?.message || 'Sign up failed')
      setLoading(false)
      return
    }

    const { error: contractorError } = await supabase.from('contractors').insert({
      user_id: data.user.id,
      business_name: businessName,
      owner_name: ownerName,
      phone,
      email,
      agreed_to_terms_at: agreedAt,
    })

    if (contractorError) {
      setError(contractorError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="QuoteBuilder" className="w-14 h-14 mb-4 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">QuoteBuilder</h1>
          <p className="text-sm text-gray-500 mt-1">Start your free trial</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            {[1, 2].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-[#0E6E7E]' : 'bg-gray-200'}`} />
            ))}
          </div>

          {step === 1 && (
            <form onSubmit={e => { e.preventDefault(); setStep(2) }} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Account details</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]"
                  placeholder="you@example.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]"
                  placeholder="Min 6 characters" required minLength={6} />
              </div>
              <button type="submit"
                className="w-full bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-2.5 rounded-lg text-sm transition">
                Continue
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Your business</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business name</label>
                <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]"
                  placeholder="ABC Handyman Services" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
                <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]"
                  placeholder="John Smith" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]"
                  placeholder="(555) 000-0000" required />
              </div>

              {/* Terms agreement */}
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-3">
                <p className="text-xs text-gray-600 leading-relaxed">
                  By signing up, you agree that Lineage Labs LLC may access, store, and use the information you enter into
                  QuoteBuilder — including quote, job, and business data — to operate, maintain, support, and improve
                  QuoteBuilder, including improving our AI features. You retain ownership of your business data. You&rsquo;re
                  responsible for having the right to enter any client/customer information you input. We don&rsquo;t sell your
                  data to third parties.
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
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50 transition">
                  Back
                </button>
                <div className="flex-1" onClick={() => !agreed && setShowTermsError(true)}>
                  <button type="submit" disabled={!agreed || loading}
                    className="w-full bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? 'Creating…' : 'Create account'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-[#0E6E7E] font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
