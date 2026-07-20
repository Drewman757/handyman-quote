import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'
import { AdminTable } from './AdminTable'
import { AdminStats } from './AdminStats'
import { CreateContractorForm } from './CreateContractorForm'
import { SignOutButton } from '@/components/SignOutButton'

export const dynamic = 'force-dynamic'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing env vars')
  return createAdmin(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/admin')

  const admin = getAdmin()

  // Verify caller is admin via service role (bypasses RLS)
  const { data: caller } = await admin
    .from('contractors')
    .select('id, is_admin')
    .eq('user_id', user.id)
    .single()

  if (!caller?.is_admin) redirect('/dashboard')

  // Fetch all contractors
  const { data: contractors } = await admin
    .from('contractors')
    .select('id, business_name, owner_name, email, created_at, is_suspended, is_admin, subscription_status')
    .order('created_at', { ascending: false })

  // Fetch quotes with just enough for the admin table's expandable per-contractor list —
  // also doubles as the count aggregate and the stats section below, no separate queries needed.
  const { data: quotes } = await admin
    .from('quotes')
    .select('id, contractor_id, status, total, created_at, sent_at, is_paid, client:clients(name)')
    .order('created_at', { ascending: false })

  const quotesByContractor = (quotes ?? []).reduce<Record<string, typeof quotes>>((acc, q) => {
    (acc[q.contractor_id] ??= []).push(q)
    return acc
  }, {})

  const rows = (contractors ?? []).map(c => {
    const contractorQuotes = (quotesByContractor[c.id] ?? []).map(q => ({
      id: q.id as string,
      status: q.status as string,
      total: q.total as number,
      created_at: q.created_at as string,
      is_paid: !!q.is_paid,
      client_name: (q.client as unknown as { name: string } | null)?.name ?? 'Unknown client',
    }))
    return {
      ...c,
      quoteCount: contractorQuotes.length,
      quotes: contractorQuotes,
    }
  })

  const activeCount = rows.filter(r => !r.is_suspended).length
  const suspendedCount = rows.filter(r => r.is_suspended).length

  // "Sent" means actually sent to a client, not a draft — same distinction used by the
  // Phase 1 quote-sent notification (sent_at is only set when the send action fires).
  const sentQuotes = (quotes ?? []).filter(q => q.sent_at)
  const totalQuotesSent = sentQuotes.length
  const totalQuoteValue = sentQuotes.reduce((sum, q) => sum + (q.total ?? 0), 0)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const quotesLast7Days = sentQuotes.filter(q => new Date(q.sent_at as string) >= sevenDaysAgo).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#0E6E7E] rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">Admin portal</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Stats pills */}
            <div className="flex items-center gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-gray-100 font-medium text-gray-600">
                {rows.length} total
              </span>
              <span className="px-3 py-1 rounded-full bg-green-100 font-semibold text-green-700">
                {activeCount} active
              </span>
              {suspendedCount > 0 && (
                <span className="px-3 py-1 rounded-full bg-red-100 font-semibold text-red-700">
                  {suspendedCount} suspended
                </span>
              )}
            </div>

            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-4">
        <AdminStats
          totalQuotesSent={totalQuotesSent}
          totalQuoteValue={totalQuoteValue}
          activeContractors={activeCount}
          quotesLast7Days={quotesLast7Days}
        />
        <CreateContractorForm />
        <AdminTable rows={rows} currentUserId={caller.id} />
      </main>
    </div>
  )
}
