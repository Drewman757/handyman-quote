import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, FileText, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/pricing'

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-purple-100 text-purple-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  expired: 'bg-yellow-100 text-yellow-700',
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // RLS ensures this client belongs to the authenticated contractor
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!client) notFound()

  const { data: quotes } = await supabase
    .from('quotes')
    .select('id, quote_number, status, total, created_at')
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  const quoteList = quotes ?? []

  const totalRevenue = quoteList
    .filter(q => q.status === 'accepted')
    .reduce((sum, q) => sum + (q.total as number), 0)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/clients" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
          <p className="text-sm text-gray-500">{client.city}, {client.state}</p>
        </div>
        <Link
          href="/quotes/new"
          className="flex items-center gap-1.5 bg-[#0E6E7E] hover:bg-[#0A5560] text-white text-sm font-medium px-3 py-2 rounded-lg transition"
        >
          <Plus className="w-3.5 h-3.5" /> New quote
        </Link>
      </div>

      {/* Client info card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Contact</h2>
        <div className="space-y-1">
          <p className="font-semibold text-gray-900">{client.name}</p>
          <p className="text-sm text-gray-600">{client.address}</p>
          <p className="text-sm text-gray-600">{client.city}, {client.state} {client.zip}</p>
          <p className="text-sm text-gray-600">{client.phone}</p>
          <p className="text-sm text-gray-600">{client.email}</p>
        </div>
        {client.notes && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-500 italic">{client.notes}</p>
          </div>
        )}
      </div>

      {/* Stats bar */}
      {quoteList.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{quoteList.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total quotes</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {quoteList.filter(q => q.status === 'accepted').length}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Accepted</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-gray-500 mt-0.5">Won revenue</p>
          </div>
        </div>
      )}

      {/* Quotes list */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Quotes{quoteList.length > 0 ? ` (${quoteList.length})` : ''}
          </h2>
        </div>

        {quoteList.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No quotes yet for this client.</p>
            <Link href="/quotes/new" className="text-sm text-[#0E6E7E] hover:underline mt-1 inline-block">
              Create the first quote →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {quoteList.map(q => (
              <Link
                key={q.id}
                href={`/quotes/${q.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition group"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 group-hover:text-[#0E6E7E] transition">
                      {q.quote_number}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(q.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[q.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {q.status}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(q.total as number)}
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
