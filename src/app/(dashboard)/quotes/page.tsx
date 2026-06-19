import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FileText } from 'lucide-react'

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-purple-100 text-purple-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  expired: 'bg-yellow-100 text-yellow-700',
}

export default async function QuotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: contractor } = await supabase.from('contractors').select('id').eq('user_id', user?.id).single()
  const { data: quotes } = await supabase
    .from('quotes')
    .select('*, client:clients(name, address)')
    .eq('contractor_id', contractor?.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
        <Link href="/quotes/new"
          className="flex items-center gap-2 bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium px-4 py-2.5 rounded-xl text-sm transition">
          <Plus className="w-4 h-4" />New quote
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        {!quotes?.length ? (
          <div className="py-16 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No quotes yet</p>
            <Link href="/quotes/new" className="text-sm text-[#0E6E7E] hover:underline mt-1 inline-block">
              Create your first quote →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
              <span className="col-span-1">#</span>
              <span className="col-span-4">Client</span>
              <span className="col-span-2">Date</span>
              <span className="col-span-2 text-right">Total</span>
              <span className="col-span-3 text-right">Status</span>
            </div>
            {quotes.map(q => (
              <Link key={q.id} href={`/quotes/${q.id}`}
                className="grid grid-cols-12 gap-4 items-center px-5 py-4 hover:bg-gray-50 transition">
                <span className="col-span-1 text-xs text-gray-400">{q.quote_number}</span>
                <div className="col-span-4">
                  <p className="text-sm font-medium text-gray-900">{(q.client as {name: string})?.name}</p>
                  <p className="text-xs text-gray-400 truncate">{(q.client as {address: string})?.address}</p>
                </div>
                <span className="col-span-2 text-xs text-gray-500">{new Date(q.created_at).toLocaleDateString()}</span>
                <span className="col-span-2 text-sm font-semibold text-gray-900 text-right">${q.total?.toLocaleString()}</span>
                <div className="col-span-3 flex justify-end">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[q.status]}`}>
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
