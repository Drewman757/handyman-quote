import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FileText, DollarSign, TrendingUp, Clock } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: contractor } = await supabase
    .from('contractors')
    .select('*')
    .eq('user_id', user?.id)
    .single()

  const { data: recentQuotes } = await supabase
    .from('quotes')
    .select('*, client:clients(name)')
    .eq('contractor_id', contractor?.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { data: allQuotes } = await supabase
    .from('quotes')
    .select('status, total')
    .eq('contractor_id', contractor?.id)

  const stats = {
    total: allQuotes?.length || 0,
    pending: allQuotes?.filter(q => ['sent', 'viewed'].includes(q.status)).length || 0,
    accepted: allQuotes?.filter(q => q.status === 'accepted').length || 0,
    revenue: allQuotes?.filter(q => q.status === 'accepted').reduce((s, q) => s + (q.total || 0), 0) || 0,
  }

  const winRate = stats.accepted + (allQuotes?.filter(q => q.status === 'declined').length || 0) > 0
    ? Math.round(stats.accepted / (stats.accepted + (allQuotes?.filter(q => q.status === 'declined').length || 0)) * 100)
    : 0

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-blue-100 text-blue-700',
    viewed: 'bg-purple-100 text-purple-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700',
    expired: 'bg-yellow-100 text-yellow-700',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {contractor?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={contractor.logo_url}
              alt={contractor.business_name}
              className="max-h-16 w-auto object-contain max-w-[200px] mb-3"
            />
          )}
          <h1 className="text-2xl font-bold text-gray-900">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            {contractor?.owner_name?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{contractor?.business_name}</p>
        </div>
        <Link href="/quotes/new"
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition">
          <Plus className="w-4 h-4" />
          New quote
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total quotes', value: stats.total, icon: FileText, color: 'text-blue-600 bg-blue-50' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-600 bg-amber-50' },
          { label: 'Win rate', value: `${winRate}%`, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
          { label: 'Revenue', value: `$${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'text-purple-600 bg-purple-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <div className={`p-1.5 rounded-lg ${color}`}><Icon className="w-3.5 h-3.5" /></div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Recent quotes */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent quotes</h2>
          <Link href="/quotes" className="text-sm text-orange-600 hover:underline">View all</Link>
        </div>
        {!recentQuotes?.length ? (
          <div className="px-5 py-10 text-center">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No quotes yet.</p>
            <Link href="/quotes/new" className="text-sm text-orange-600 hover:underline mt-1 inline-block">
              Create your first quote
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentQuotes.map(q => (
              <Link key={q.id} href={`/quotes/${q.id}`}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition">
                <div>
                  <p className="text-sm font-medium text-gray-900">{(q.client as {name: string})?.name}</p>
                  <p className="text-xs text-gray-400">{q.quote_number} · {new Date(q.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-gray-900">${q.total?.toLocaleString()}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[q.status]}`}>
                    {q.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
