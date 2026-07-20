'use client'

import { formatCurrency, getPricingFlag } from '@/lib/utils/pricing'
import type { QuoteAnalytics, LineItemAnalytics, QuoteFunnelStage } from '@/lib/types'
import { TrendingUp, TrendingDown, DollarSign, FileText, AlertTriangle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'

interface AnalyticsDashboardProps {
  analytics: QuoteAnalytics
  lineItemAnalytics: LineItemAnalytics[]
  funnelData: QuoteFunnelStage[]
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
        </div>
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

const FLAG_COLORS = {
  ok: 'bg-green-50 text-green-700 border-green-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  very_high: 'bg-red-50 text-red-700 border-red-200',
}

const FLAG_LABELS = {
  ok: 'Pricing OK',
  high: 'May be high',
  very_high: 'Likely too high',
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tooltipFormatter(val: any, name: any): [string, string] {
  return [`${val} quotes`, name]
}

export function AnalyticsDashboard({ analytics, lineItemAnalytics, funnelData }: AnalyticsDashboardProps) {
  // Accepted is split into Paid / Not yet paid (stacked); Declined and Pending stay as
  // single bars — `main` carries their value, 0 for Accepted where `paid`/`notPaid` apply
  // instead. All three share stackId="a" so only the relevant segment(s) render per bar.
  const winLossData = [
    {
      name: 'Accepted',
      main: 0,
      paid: analytics.paid_quotes,
      notPaid: Math.max(0, analytics.accepted_quotes - analytics.paid_quotes),
      color: '#22c55e',
    },
    { name: 'Declined', main: analytics.declined_quotes, paid: 0, notPaid: 0, color: '#ef4444' },
    { name: 'Pending', main: analytics.pending_quotes, paid: 0, notPaid: 0, color: '#f59e0b' },
  ]

  const flaggedItems = lineItemAnalytics
    .filter((li) => li.times_quoted >= 3)
    .map((li) => ({ ...li, price_flag: getPricingFlag(li.win_rate) }))
    .sort((a, b) => a.win_rate - b.win_rate)

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Win rate"
          value={`${analytics.win_rate.toFixed(1)}%`}
          sub={`${analytics.accepted_quotes} of ${analytics.accepted_quotes + analytics.declined_quotes} responded`}
          icon={TrendingUp}
          color="bg-green-50 text-green-600"
        />
        <StatCard
          label="Total revenue"
          value={formatCurrency(analytics.total_revenue)}
          sub="Accepted quotes"
          icon={DollarSign}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Pipeline"
          value={formatCurrency(analytics.total_pipeline)}
          sub="Sent & viewed"
          icon={TrendingDown}
          color="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Avg quote value"
          value={formatCurrency(analytics.avg_quote_value)}
          sub="All sent quotes"
          icon={FileText}
          color="bg-purple-50 text-purple-600"
        />
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Win / loss breakdown</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={winLossData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {/* Renders the single-color Declined/Pending bars (0 for Accepted, which uses
                the paid/notPaid bars below instead) — excluded from the legend since its
                per-category Cell colors have no single swatch to show there. */}
            <Bar dataKey="main" stackId="a" radius={[4, 4, 0, 0]} name="Quotes" legendType="none">
              {winLossData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
            <Bar dataKey="paid" stackId="a" fill="#16a34a" name="Paid" />
            <Bar dataKey="notPaid" stackId="a" radius={[4, 4, 0, 0]} fill="#86efac" name="Not yet paid" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Quote lifecycle funnel</h2>
        <p className="mb-4 text-sm text-gray-500">
          Each quote counted once, at the furthest stage it&rsquo;s reached. Declined is a separate
          end-state, not part of the linear flow.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={funnelData} margin={{ top: 4, right: 16, bottom: 48, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="stage"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={70}
            />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
            <Tooltip formatter={tooltipFormatter} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Quotes">
              {funnelData.map((entry, i) => (
                <Cell key={i} fill={entry.stage === 'Declined' ? '#ef4444' : '#0E6E7E'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900">Line item pricing analysis</h2>
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Items with low win rates may indicate pricing above market. Only shown when you have 3+ data points.
        </p>

        {flaggedItems.length === 0 ? (
          <p className="text-sm text-gray-400">Not enough data yet — send more quotes to unlock insights.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 pb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
              <span className="col-span-5">Line item</span>
              <span className="col-span-2 text-right">Quoted</span>
              <span className="col-span-2 text-right">Win rate</span>
              <span className="col-span-2 text-right">Avg price</span>
              <span className="col-span-1" />
            </div>
            {flaggedItems.map((item, i) => (
              <div
                key={i}
                className="grid grid-cols-12 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm"
              >
                <span className="col-span-5 font-medium text-gray-800 truncate">{item.description}</span>
                <span className="col-span-2 text-right text-gray-500">{item.times_quoted}</span>
                <span className="col-span-2 text-right text-gray-700">{item.win_rate.toFixed(0)}%</span>
                <span className="col-span-2 text-right text-gray-700">{formatCurrency(item.avg_price)}</span>
                <span className="col-span-1 flex justify-end">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${FLAG_COLORS[item.price_flag]}`}>
                    {FLAG_LABELS[item.price_flag]}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
