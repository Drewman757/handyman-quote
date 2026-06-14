import { createClient } from '@/lib/supabase/server'
import { Users } from 'lucide-react'
import Link from 'next/link'

export default async function ClientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: contractor } = await supabase.from('contractors').select('id').eq('user_id', user?.id).single()
  const { data: clients } = await supabase
    .from('clients')
    .select('*, quotes(count)')
    .eq('contractor_id', contractor?.id)
    .order('name')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
      <div className="bg-white rounded-xl border border-gray-200">
        {!clients?.length ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No clients yet — they&apos;ll appear here when you create quotes.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {clients.map(c => (
              <div key={c.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-sm text-gray-500">{c.address}, {c.city} · {c.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-400">{c.phone}</p>
                  <Link href={`/quotes/new`} className="text-xs text-orange-600 hover:underline">New quote</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
