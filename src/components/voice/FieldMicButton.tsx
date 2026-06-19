'use client'

import { useEffect, useRef } from 'react'
import { useVoiceRecorder } from '@/lib/hooks/useVoiceRecorder'
import { Mic } from 'lucide-react'

interface FieldMicButtonProps {
  onResult: (transcript: string) => void
}

export function FieldMicButton({ onResult }: FieldMicButtonProps) {
  const { state, transcript, startRecording, stopRecording, resetRecording, isSupported } = useVoiceRecorder()

  // Keep a stable ref so the effect below never goes stale on onResult identity changes
  const onResultRef = useRef(onResult)
  useEffect(() => { onResultRef.current = onResult })

  const isActive = state === 'recording' || state === 'paused'

  useEffect(() => {
    if (state === 'done') {
      const text = transcript.trim()
      if (text) onResultRef.current(text)
      resetRecording()
    }
  // resetRecording is stable (useCallback), state and transcript drive the trigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, transcript, resetRecording])

  if (!isSupported) return null

  function handleClick() {
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
      title={isActive ? 'Tap to stop' : 'Tap to dictate'}
      className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border transition ${
        isActive
          ? 'border-red-300 bg-red-50 text-red-500 animate-pulse'
          : 'border-gray-300 text-[#0E6E7E] hover:border-[#0E6E7E] hover:bg-[#EFF9FA]'
      }`}
    >
      <Mic className="w-3.5 h-3.5" />
    </button>
  )
}
