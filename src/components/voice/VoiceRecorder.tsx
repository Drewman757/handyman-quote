'use client'

import { useVoiceRecorder } from '@/lib/hooks/useVoiceRecorder'
import { formatDuration } from '@/lib/utils/pricing'
import { Mic, MicOff, Pause, Play, Square, RotateCcw } from 'lucide-react'
import { useEffect } from 'react'

interface VoiceRecorderProps {
  onTranscriptChange: (transcript: string) => void
  className?: string
}

export function VoiceRecorder({ onTranscriptChange, className }: VoiceRecorderProps) {
  const {
    state,
    transcript,
    interimTranscript,
    duration,
    error,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    isSupported,
  } = useVoiceRecorder()

  useEffect(() => {
    onTranscriptChange(transcript)
  }, [transcript, onTranscriptChange])

  if (!isSupported) {
    return (
      <div className={`rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 ${className}`}>
        <MicOff className="mb-1 inline h-4 w-4" /> Voice recording isn&apos;t supported in this browser.
        Use Chrome or Safari on mobile.
      </div>
    )
  }

  const isRecording = state === 'recording'
  const isPaused = state === 'paused'
  const isDone = state === 'done'
  const isActive = isRecording || isPaused

  return (
    <div className={`rounded-xl border bg-white shadow-sm ${className}`}>
      {/* Header bar */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              isRecording ? 'animate-pulse bg-red-500' : isPaused ? 'bg-amber-400' : 'bg-gray-300'
            }`}
          />
          <span className="text-sm font-medium text-gray-700">
            {isRecording ? 'Recording…' : isPaused ? 'Paused' : isDone ? 'Recording complete' : 'Voice recorder'}
          </span>
        </div>
        {isActive || isDone ? (
          <span className="font-mono text-sm text-gray-500">{formatDuration(duration)}</span>
        ) : null}
      </div>

      {/* Transcript area */}
      <div className="min-h-[100px] p-4">
        {!isActive && !isDone && (
          <p className="text-sm text-gray-400">
            Walk through the job and describe each task. The app will transcribe your voice in real time.
          </p>
        )}
        {(isActive || isDone) && (
          <div className="text-sm leading-relaxed text-gray-800">
            <span>{transcript}</span>
            {interimTranscript && (
              <span className="text-gray-400"> {interimTranscript}</span>
            )}
            {!transcript && !interimTranscript && isRecording && (
              <span className="text-gray-400 italic">Listening…</span>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 border-t px-4 py-3">
        {state === 'idle' && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 active:scale-95"
          >
            <Mic className="h-4 w-4" />
            Start recording
          </button>
        )}

        {isRecording && (
          <>
            <button
              onClick={pauseRecording}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <Pause className="h-4 w-4" />
              Pause
            </button>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-900"
            >
              <Square className="h-4 w-4 fill-current" />
              Done
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button
              onClick={resumeRecording}
              className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
            >
              <Play className="h-4 w-4 fill-current" />
              Resume
            </button>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <Square className="h-4 w-4 fill-current" />
              Done
            </button>
          </>
        )}

        {isDone && (
          <button
            onClick={resetRecording}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Re-record
          </button>
        )}
      </div>
    </div>
  )
}
