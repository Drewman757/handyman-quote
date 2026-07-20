import { FileText, DollarSign, UserCheck, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/pricing'

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
        </div>
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

export function AdminStats({
  totalQuotesSent,
  totalQuoteValue,
  activeContractors,
  quotesLast7Days,
}: {
  totalQuotesSent: number
  totalQuoteValue: number
  activeContractors: number
  quotesLast7Days: number
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Quotes sent"
        value={totalQuotesSent}
        icon={FileText}
        color="bg-blue-50 text-blue-600"
      />
      <StatCard
        label="Total quote value"
        value={formatCurrency(totalQuoteValue)}
        icon={DollarSign}
        color="bg-green-50 text-green-600"
      />
      <StatCard
        label="Active contractors"
        value={activeContractors}
        icon={UserCheck}
        color="bg-[#EFF9FA] text-[#0E6E7E]"
      />
      <StatCard
        label="Sent, last 7 days"
        value={quotesLast7Days}
        icon={Clock}
        color="bg-amber-50 text-amber-600"
      />
    </div>
  )
}
