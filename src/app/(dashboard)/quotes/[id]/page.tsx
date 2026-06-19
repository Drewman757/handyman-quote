import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, getUnitLabel } from '@/lib/utils/pricing'
import { ArrowLeft } from 'lucide-react'
import { QuoteActions } from './QuoteActions'
import { FollowUp } from './FollowUp'

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  viewed: 'bg-purple-100 text-purple-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  expired: 'bg-yellow-100 text-yellow-700',
}

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: quote } = await supabase
    .from('quotes')
    .select('*, client:clients(*), line_items(*), contractor:contractors(*)')
    .eq('id', id)
    .single()

  if (!quote) notFound()

  const client = quote.client as Record<string, string>
  const contractor = quote.contractor as Record<string, string | null> | null
  const lineItems = (quote.line_items as Record<string, unknown>[]) || []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/quotes" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{quote.quote_number}</h1>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColors[quote.status]}`}>{quote.status}</span>
          </div>
          <p className="text-sm text-gray-500">{client?.name}</p>
        </div>
        <QuoteActions quoteId={quote.id} status={quote.status} clientEmail={client?.email} />
      </div>

      {/* Contractor branding — shown only when a logo is uploaded */}
      {contractor?.logo_url && (
        <div
          style={{ backgroundColor: '#0E6E7E18', borderColor: '#0E6E7E40' }}
          className="rounded-xl border px-5 py-3 flex items-center gap-3"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={contractor.logo_url ?? ''}
            alt={contractor.business_name ?? ''}
            className="h-10 w-auto object-contain max-w-[160px]"
          />
          <span style={{ color: '#0E6E7E' }} className="text-sm font-medium">{contractor.business_name}</span>
        </div>
      )}

      {/* Client info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Client</h2>
        <p className="font-semibold text-gray-900">{client?.name}</p>
        <p className="text-sm text-gray-600">{client?.address}, {client?.city}, {client?.state} {client?.zip}</p>
        <p className="text-sm text-gray-600">{client?.phone} · {client?.email}</p>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Line items</h2>
        <div className="space-y-3">
          {lineItems.sort((a, b) => (a.sort_order as number) - (b.sort_order as number)).map(li => {
            if (li.item_type === 'section') {
              return (
                <div key={li.id as string} className="pt-1.5 pb-0.5">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{li.description as string}</p>
                </div>
              )
            }
            return (
              <div key={li.id as string} className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-900">{li.description as string}</p>
                  {li.pricing_type !== 'fixed' && (
                    <p className="text-xs text-gray-400">
                      {li.quantity as number} {getUnitLabel(li.pricing_type as 'sqft' | 'hourly')} × {formatCurrency(li.unit_price as number)}
                    </p>
                  )}
                </div>
                {!quote.lump_sum && <p className="text-sm font-semibold text-gray-900">{formatCurrency(li.total as number)}</p>}
              </div>
            )
          })}
        </div>
        <div className="border-t border-gray-100 mt-4 pt-4 space-y-1.5">
          {!quote.lump_sum && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span><span>{formatCurrency(quote.subtotal)}</span>
            </div>
          )}
          {!quote.lump_sum && quote.tax_rate > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax ({(quote.tax_rate * 100).toFixed(1)}%)</span><span>{formatCurrency(quote.tax_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-gray-900 pt-1">
            <span>Total</span><span>{formatCurrency(quote.total)}</span>
          </div>
        </div>
      </div>

      {/* Terms */}
      {(quote.payment_terms || quote.caveats) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
          {quote.payment_terms && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Payment terms</h2>
              <p className="text-sm text-gray-700">{quote.payment_terms}</p>
            </div>
          )}
          {quote.caveats && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</h2>
              <p className="text-sm text-gray-700">{quote.caveats}</p>
            </div>
          )}
        </div>
      )}

      {/* Voice transcript */}
      {quote.voice_transcript && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Voice notes</h2>
          <p className="text-sm text-gray-600 italic">{quote.voice_transcript}</p>
        </div>
      )}

      {/* Follow-up — only for sent quotes */}
      {quote.status === 'sent' && (
        <FollowUp
          quoteId={quote.id}
          followUpDate={(quote.follow_up_date as string | null) ?? null}
          followUpSentAt={(quote.follow_up_sent_at as string | null) ?? null}
        />
      )}
    </div>
  )
}
