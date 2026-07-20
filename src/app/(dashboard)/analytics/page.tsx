import { createClient } from '@/lib/supabase/server'
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'
import type { QuoteAnalytics, LineItemAnalytics, QuoteFunnelStage } from '@/lib/types'

// Same 7-stage flow as the quote detail page's LifecycleStepper — kept in sync manually
// since these are independent manual toggles, not a single enforced status enum.
const FUNNEL_STAGES = ['Draft', 'Sent', 'Follow-up', 'Accepted', 'Project Started', 'Invoice Sent', 'Paid']

function furthestStage(q: {
  status: string
  sent_at: string | null
  follow_up_sent_at: string | null
  project_started_at: string | null
  invoice_sent_at: string | null
  is_paid: boolean | null
}): string {
  const reached = [
    true,
    !!q.sent_at,
    !!q.follow_up_sent_at,
    q.status === 'accepted',
    !!q.project_started_at,
    !!q.invoice_sent_at,
    !!q.is_paid,
  ]
  let furthestIndex = 0
  reached.forEach((done, i) => { if (done) furthestIndex = i })
  return FUNNEL_STAGES[furthestIndex]
}

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: contractor } = await supabase.from('contractors').select('id').eq('user_id', user?.id).single()

  const { data: analyticsRow } = await supabase
    .from('quote_analytics')
    .select('*')
    .eq('contractor_id', contractor?.id)
    .maybeSingle()

  const { data: lineItemRows } = await supabase
    .from('line_item_analytics')
    .select('*')
    .eq('contractor_id', contractor?.id)

  const analytics: QuoteAnalytics = {
    total_quotes: analyticsRow?.total_quotes || 0,
    sent_quotes: (analyticsRow?.pending_quotes || 0) + (analyticsRow?.accepted_quotes || 0) + (analyticsRow?.declined_quotes || 0),
    accepted_quotes: analyticsRow?.accepted_quotes || 0,
    paid_quotes: analyticsRow?.paid_quotes || 0,
    declined_quotes: analyticsRow?.declined_quotes || 0,
    pending_quotes: analyticsRow?.pending_quotes || 0,
    win_rate: parseFloat(analyticsRow?.win_rate_pct || '0'),
    avg_quote_value: parseFloat(analyticsRow?.avg_quote_value || '0'),
    total_revenue: parseFloat(analyticsRow?.total_revenue || '0'),
    total_pipeline: parseFloat(analyticsRow?.pipeline_value || '0'),
  }

  const lineItemAnalytics: LineItemAnalytics[] = (lineItemRows || []).map(r => ({
    description: r.description,
    times_quoted: r.times_quoted,
    times_accepted: r.times_accepted,
    times_declined: r.times_declined,
    win_rate: parseFloat(r.win_rate_pct || '0'),
    avg_price: parseFloat(r.avg_unit_price || '0'),
    price_flag: 'ok' as const,
  }))

  // Raw rows (not the aggregate view) — furthest-stage-reached needs per-quote fields,
  // computed here rather than via a new SQL view/migration for this one chart.
  const { data: lifecycleQuotes } = await supabase
    .from('quotes')
    .select('status, sent_at, follow_up_sent_at, project_started_at, invoice_sent_at, is_paid')
    .eq('contractor_id', contractor?.id)

  const stageCounts = new Map<string, number>(FUNNEL_STAGES.map(label => [label, 0]))
  let declinedCount = 0
  for (const q of lifecycleQuotes ?? []) {
    if (q.status === 'declined') {
      declinedCount++
      continue
    }
    const stage = furthestStage(q)
    stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1)
  }

  // Declined kept as its own distinct bar, not folded into the linear flow — same
  // treatment as the per-quote LifecycleStepper's end-state handling.
  const funnelData: QuoteFunnelStage[] = [
    ...FUNNEL_STAGES.map(stage => ({ stage, count: stageCounts.get(stage) ?? 0 })),
    { stage: 'Declined', count: declinedCount },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
      <AnalyticsDashboard analytics={analytics} lineItemAnalytics={lineItemAnalytics} funnelData={funnelData} />
    </div>
  )
}
