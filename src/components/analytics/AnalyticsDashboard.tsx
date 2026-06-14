'use client'

import { formatCurrency, getPricingFlag } from '@/lib/utils/pricing'
import type { QuoteAnalytics, LineItemAnalytics } from '@/lib/types'
import { TrendingUp, TrendingDown, DollarSign, FileText, AlertTriangle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

interface AnalyticsDashboardProps {
  analytics: QuoteAnalytics
  lineItemAnalytics: LineItemAnalytics[]
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

export function AnalyticsDashboard({ analytics, lineItemAnalytics }: AnalyticsDashboardProps) {
  const winLossData = [
    { name: 'Accepted', value: analytics.accepted_quotes, color: '#22c55e' },
    { name: 'Declined', value: analytics.declined_quotes, color: '#ef4444' },
    { name: 'Pending', value: analytics.pending_quotes, color: '#f59e0b' },
  ]

  // Line items sorted by win rate ascending (problem items first)
  const flaggedItems = lineItemAnalytics
    .filter((li) => li.times_quoted >= 3) // only flag items with enough data
    .map((li) => ({ ...li, price_flag: getPricingFlag(li.win_rate) }))
    .sort((a, b) => a.win_rate - b.win_rate)

  return (
    <div className="space-y-8">
      {/* Stat cards */}
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

      {/* Win/Loss chart */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Win / loss breakdown</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={winLossData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} allowDecimals={false} />
            <Tooltip formatter={(val: number) => [`${val} quotes`, '']} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {winLossData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Line item pricing heat map */}
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
                <span className="col-span-2 text-right text-gray-700">{formatCurrency(item.avg_unit_price)}</span>
                <span className="col-span-1 flex justify-end">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${FLAG_COLORS[item.price_flag]}`}
                  >
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
