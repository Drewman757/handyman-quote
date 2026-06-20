'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Send, FileDown, Pencil, Copy } from 'lucide-react'

export function QuoteActions({ quoteId, status, clientEmail }: {
  quoteId: string
  status: string
  clientEmail: string
}) {
  const [loading, setLoading] = useState('')
  const [confirmEmail, setConfirmEmail] = useState(false)
  const [pricingChecked, setPricingChecked] = useState(false)
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
    setConfirmEmail(false)
    setPricingChecked(false)
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

  async function duplicate() {
    setLoading('duplicate')
    const res = await fetch(`/api/quotes/${quoteId}/duplicate`, { method: 'POST' })
    const data = await res.json()
    if (res.ok && data.quoteId) {
      router.push(`/quotes/${data.quoteId}`)
    }
    setLoading('')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto overscroll-x-contain touch-pan-x">
        <a
          href={`/quotes/${quoteId}/edit`}
          className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg transition"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </a>
        <button
          onClick={duplicate}
          disabled={loading === 'duplicate'}
          className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50"
        >
          <Copy className="w-3.5 h-3.5" />
          {loading === 'duplicate' ? 'Copying…' : 'Duplicate'}
        </button>
        <a
          href={`/api/quotes/${quoteId}/pdf`}
          download
          className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg transition"
        >
          <FileDown className="w-3.5 h-3.5" />
          PDF
        </a>
        {(status === 'draft' || status === 'sent') && clientEmail && (
          <button
            onClick={() => { setConfirmEmail(true); setPricingChecked(false) }}
            disabled={loading === 'email' || confirmEmail}
            className="flex items-center gap-1.5 bg-[#0E6E7E] hover:bg-[#0A5560] text-white text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50">
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

      {confirmEmail && (
        <div className="bg-[#EFF9FA] border border-[#0E6E7E]/30 rounded-xl p-4 space-y-3">
          <p className="text-sm text-gray-800 font-medium">Before sending — please double-check all pricing is correct. Clients will see this quote as final.</p>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pricingChecked}
              onChange={e => setPricingChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-[#0E6E7E]"
            />
            <span className="text-sm text-gray-700">I&apos;ve reviewed the pricing</span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => { setConfirmEmail(false); setPricingChecked(false) }}
              className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              onClick={sendEmail}
              disabled={!pricingChecked || loading === 'email'}
              className="flex-1 bg-[#0E6E7E] hover:bg-[#0A5560] text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50">
              {loading === 'email' ? 'Sending…' : 'Confirm & send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
