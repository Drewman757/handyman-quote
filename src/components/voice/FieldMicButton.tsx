'use client'

import { useState, useEffect, useRef } from 'react'
import { useVoiceRecorder } from '@/lib/hooks/useVoiceRecorder'
import { Loader2, Mic } from 'lucide-react'

type FieldType = 'description' | 'section_title' | 'payment_terms' | 'caveats' | 'financing_options'

interface FieldMicButtonProps {
  onResult: (transcript: string) => void
  fieldType?: FieldType
}

export function FieldMicButton({ onResult, fieldType }: FieldMicButtonProps) {
  const { state, transcript, startRecording, stopRecording, resetRecording, isSupported } = useVoiceRecorder()
  const [cleaning, setCleaning] = useState(false)

  // Stable refs so effects never go stale on prop identity changes
  const onResultRef = useRef(onResult)
  useEffect(() => { onResultRef.current = onResult })

  const fieldTypeRef = useRef(fieldType)
  useEffect(() => { fieldTypeRef.current = fieldType })

  const isActive = state === 'recording' || state === 'paused'

  useEffect(() => {
    if (state !== 'done') return
    const text = transcript.trim()
    if (!text) {
      resetRecording()
      return
    }

    let cancelled = false
    setCleaning(true)

    const run = async () => {
      let result = text
      const ft = fieldTypeRef.current
      if (ft) {
        try {
          const res = await fetch('/api/ai/clean-transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript: text, fieldType: ft }),
          })
          if (res.ok) {
            const data = await res.json() as { cleaned?: string }
            if (data.cleaned?.trim()) result = data.cleaned.trim()
          }
        } catch (err) {
          console.error('[FieldMicButton] cleanup failed, using raw transcript', err)
        }
      }
      if (!cancelled) {
        setCleaning(false)
        onResultRef.current(result)
        resetRecording()
      }
    }

    run()
    return () => { cancelled = true }
  // resetRecording is stable (useCallback), state and transcript drive the trigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, transcript, resetRecording])

  if (!isSupported) return null

  function handleClick() {
    if (cleaning) return
    if (isActive) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={cleaning}
      title={cleaning ? 'Processing…' : isActive ? 'Tap to stop' : 'Tap to dictate'}
      className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border transition ${
        cleaning
          ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-wait'
          : isActive
          ? 'border-red-300 bg-red-50 text-red-500 animate-pulse'
          : 'border-gray-300 text-[#0E6E7E] hover:border-[#0E6E7E] hover:bg-[#EFF9FA]'
      }`}
    >
      {cleaning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mic className="w-3.5 h-3.5" />}
    </button>
  )
}
