'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Send, FileDown } from 'lucide-react'

export function QuoteActions({ quoteId, status, clientEmail }: {
  quoteId: string
  status: string
  clientEmail: string
}) {
  const [loading, setLoading] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function markStatus(newStatus: string) {
    setLoading(newStatus)
    await supabase.from('quotes').update({
      status: newStatus,
      responded_at: new Date().toISOString(),
    }).eq('id', quoteId)
    router.refresh()
    setLoading('')
  }

  async function sendEmail() {
    setLoading('email')
    await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId }),
    })
    await supabase.from('quotes').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', quoteId)
    router.refresh()
    setLoading('')
  }

  return (
    <div className="flex items-center gap-2">
      <a
        href={`/api/quotes/${quoteId}/pdf`}
        download
        className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg transition"
      >
        <FileDown className="w-3.5 h-3.5" />
        PDF
      </a>
      {(status === 'draft' || status === 'sent') && clientEmail && (
        <button onClick={sendEmail} disabled={loading === 'email'}
          className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50">
          <Send className="w-3.5 h-3.5" />
          {loading === 'email' ? 'Sending…' : 'Email quote'}
        </button>
      )}
      {status === 'sent' || status === 'viewed' ? (
        <>
          <button onClick={() => markStatus('accepted')} disabled={!!loading}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50">
            <CheckCircle className="w-3.5 h-3.5" />Won
          </button>
          <button onClick={() => markStatus('declined')} disabled={!!loading}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50">
            <XCircle className="w-3.5 h-3.5" />Lost
          </button>
        </>
      ) : null}
    </div>
  )
}
