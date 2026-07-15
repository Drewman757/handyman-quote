import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing env vars')
  return createAdmin(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

export default async function TrialExpiredPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/trial-expired')

  const admin = getAdmin()
  const { data: contractor } = await admin
    .from('contractors')
    .select('business_name, trial_ends_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const trialEndDateStr = contractor?.trial_ends_at
    ? new Date(contractor.trial_ends_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="w-14 h-14 bg-[#EFF9FA] rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-7 h-7 text-[#0E6E7E]" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Your beta trial has ended</h1>
        {trialEndDateStr && (
          <p className="text-sm text-gray-500 mt-2">
            {contractor?.business_name ? `${contractor.business_name}'s` : 'Your'} trial ended on{' '}
            <strong className="text-gray-700">{trialEndDateStr}</strong>.
          </p>
        )}
        <p className="text-sm text-gray-600 mt-4 leading-relaxed">
          Don&rsquo;t worry &mdash; all of your quotes, clients, and pricing templates are safe. Nothing has been
          deleted, and everything will be available immediately after you upgrade.
        </p>
        <a
          href="/api/stripe/upgrade-checkout"
          className="mt-6 inline-block w-full bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-3 rounded-lg text-sm transition"
        >
          Upgrade to continue — $50/month
        </a>
      </div>
    </div>
  )
}
