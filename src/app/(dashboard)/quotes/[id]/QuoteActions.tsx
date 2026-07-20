'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Send, FileDown, Pencil, Copy, DollarSign, Hammer, Receipt } from 'lucide-react'

export function QuoteActions({ quoteId, status, clientEmail, isPaid, isProjectStarted, isInvoiceSent }: {
  quoteId: string
  status: string
  clientEmail: string
  isPaid: boolean
  isProjectStarted: boolean
  isInvoiceSent: boolean
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
      // Only a real decision (accepted/declined) counts as a "response" — reverting
      // back to sent means there's no longer a recorded decision.
      responded_at: (newStatus === 'accepted' || newStatus === 'declined') ? new Date().toISOString() : null,
    }).eq('id', quoteId)
    router.refresh()
    setLoading('')
  }

  // Won/Lost are toggles, same pattern as Mark as Paid — clicking an already-active
  // one reverts back to "sent" (awaiting response) rather than being a one-way action.
  function toggleWon() {
    return markStatus(status === 'accepted' ? 'sent' : 'accepted')
  }
  function toggleLost() {
    return markStatus(status === 'declined' ? 'sent' : 'declined')
  }

  // Independent of send status by design — a contractor can get paid in cash before,
  // during, or after the quote is ever emailed, so this isn't gated on `status`.
  async function togglePaid() {
    setLoading('paid')
    const nowPaid = !isPaid
    await supabase.from('quotes').update({
      is_paid: nowPaid,
      paid_at: nowPaid ? new Date().toISOString() : null,
      // Paid implies Won — a contractor wouldn't mark something paid that wasn't
      // accepted. One-directional only: unmarking paid never reverts status back.
      ...(nowPaid && status !== 'accepted'
        ? { status: 'accepted', responded_at: new Date().toISOString() }
        : {}),
    }).eq('id', quoteId)
    router.refresh()
    setLoading('')
  }

  // Manual markers only, same as Mark as Paid — no emails/actions triggered, just a
  // reversible timestamp toggle.
  async function toggleProjectStarted() {
    setLoading('project')
    await supabase.from('quotes').update({
      project_started_at: isProjectStarted ? null : new Date().toISOString(),
    }).eq('id', quoteId)
    router.refresh()
    setLoading('')
  }

  async function toggleInvoiceSent() {
    setLoading('invoice')
    await supabase.from('quotes').update({
      invoice_sent_at: isInvoiceSent ? null : new Date().toISOString(),
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
        <button
          onClick={togglePaid}
          disabled={loading === 'paid'}
          className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50 ${
            isPaid
              ? 'bg-green-100 hover:bg-green-200 text-green-700'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          {loading === 'paid' ? 'Updating…' : isPaid ? 'Paid ✓' : 'Mark as Paid'}
        </button>
        <button
          onClick={toggleProjectStarted}
          disabled={loading === 'project'}
          className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50 ${
            isProjectStarted
              ? 'bg-green-100 hover:bg-green-200 text-green-700'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          <Hammer className="w-3.5 h-3.5" />
          {loading === 'project' ? 'Updating…' : isProjectStarted ? 'Project Started ✓' : 'Project Started'}
        </button>
        <button
          onClick={toggleInvoiceSent}
          disabled={loading === 'invoice'}
          className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50 ${
            isInvoiceSent
              ? 'bg-green-100 hover:bg-green-200 text-green-700'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          {loading === 'invoice' ? 'Updating…' : isInvoiceSent ? 'Invoice Sent ✓' : 'Invoice Sent'}
        </button>
        {(status === 'draft' || status === 'sent') && clientEmail && (
          <button
            onClick={() => { setConfirmEmail(true); setPricingChecked(false) }}
            disabled={loading === 'email' || confirmEmail}
            className="flex items-center gap-1.5 bg-[#0E6E7E] hover:bg-[#0A5560] text-white text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50">
            <Send className="w-3.5 h-3.5" />
            {loading === 'email' ? 'Sending…' : 'Email quote'}
          </button>
        )}
        {status === 'sent' || status === 'viewed' || status === 'accepted' || status === 'declined' ? (
          <>
            <button
              onClick={toggleWon}
              disabled={!!loading}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50 ${
                status === 'accepted'
                  ? 'bg-green-100 hover:bg-green-200 text-green-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {status === 'accepted' ? 'Won ✓' : 'Won'}
            </button>
            <button
              onClick={toggleLost}
              disabled={!!loading}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg transition disabled:opacity-50 ${
                status === 'declined'
                  ? 'bg-red-100 hover:bg-red-200 text-red-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              {status === 'declined' ? 'Lost ✓' : 'Lost'}
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
