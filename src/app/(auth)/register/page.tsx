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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
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
          <img src="/icon.svg" alt="QuoteBuilder" className="w-14 h-14 mb-4 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900">QuoteBuilder</h1>
          <p className="text-sm text-gray-500 mt-1">Start your free trial</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-5">
            {[1, 2].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-orange-500' : 'bg-gray-200'}`} />
            ))}
          </div>

          {step === 1 && (
            <form onSubmit={e => { e.preventDefault(); setStep(2) }} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Account details</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="you@example.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Min 6 characters" required minLength={6} />
              </div>
              <button type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-lg text-sm transition">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="ABC Handyman Services" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
                <input type="text" value={ownerName} onChange={e => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="John Smith" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="(555) 000-0000" required />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep(1)}
                  className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 rounded-lg text-sm hover:bg-gray-50 transition">
                  Back
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50">
                  {loading ? 'Creating…' : 'Create account'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link href="/login" className="text-orange-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
