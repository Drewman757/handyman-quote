'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Bell, Send } from 'lucide-react'

export function FollowUp({
  quoteId,
  followUpDate,
  followUpSentAt,
}: {
  quoteId: string
  followUpDate: string | null
  followUpSentAt: string | null
}) {
  const [date, setDate] = useState(followUpDate ?? '')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [sentAt, setSentAt] = useState(followUpSentAt)
  const router = useRouter()
  const supabase = createClient()

  async function saveDate() {
    if (!date) return
    setSaving(true)
    await supabase.from('quotes').update({ follow_up_date: date }).eq('id', quoteId)
    setSaving(false)
    router.refresh()
  }

  async function sendFollowUp() {
    setSending(true)
    const res = await fetch(`/api/quotes/${quoteId}/followup`, { method: 'POST' })
    if (res.ok) {
      setSentAt(new Date().toISOString())
      router.refresh()
    }
    setSending(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-4 h-4 text-[#0E6E7E]" />
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Follow-up</h2>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">Follow-up date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0E6E7E]"
          />
        </div>
        <button
          onClick={saveDate}
          disabled={!date || saving}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save date'}
        </button>
      </div>

      <div className="mt-3">
        {sentAt ? (
          <p className="text-sm text-green-600 font-medium">
            Follow-up sent {new Date(sentAt).toLocaleDateString()}
          </p>
        ) : (
          <button
            onClick={sendFollowUp}
            disabled={sending}
            className="flex items-center gap-2 mt-1 bg-[#0E6E7E] hover:bg-[#0A5560] text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? 'Sending…' : 'Send follow-up email'}
          </button>
        )}
      </div>
    </div>
  )
}
