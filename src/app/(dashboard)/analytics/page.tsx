import { createClient } from '@/lib/supabase/server'
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'
import type { QuoteAnalytics, LineItemAnalytics } from '@/lib/types'

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
      <AnalyticsDashboard analytics={analytics} lineItemAnalytics={lineItemAnalytics} />
    </div>
  )
}
