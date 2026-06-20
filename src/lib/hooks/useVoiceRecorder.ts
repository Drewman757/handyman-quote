'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export type RecordingState = 'idle' | 'recording' | 'paused' | 'processing' | 'done' | 'error'

export interface UseVoiceRecorderReturn {
  state: RecordingState
  transcript: string
  interimTranscript: string
  duration: number
  error: string | null
  startRecording: () => void
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  resetRecording: () => void
  isSupported: boolean
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = useState<RecordingState>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const accumulatedRef = useRef<number>(0)
  // Controls mobile auto-restart: mobile Chrome stops continuous recognition on silence
  const shouldRestartRef = useRef(false)
  // Set true by stopRecording so onend knows to transition to 'done' (not restart)
  const stopPendingRef = useRef(false)
  // Holds the createRecognition factory so onend can spawn a fresh instance on restart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createRecognitionRef = useRef<(() => any) | null>(null)

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setDuration(accumulatedRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 500)
  }, [])

  const createRecognition = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      if (recognitionRef.current !== recognition) return // stale instance — ignore late events
      let final = ''
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript + ' '
        } else {
          interim += result[0].transcript
        }
      }
      if (final) setTranscript((prev) => prev + final)
      setInterimTranscript(interim)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (recognitionRef.current !== recognition) return // stale instance — ignore late errors
      if (event.error === 'no-speech') return
      setError(`Voice recognition error: ${event.error}`)
      setState('error')
      shouldRestartRef.current = false
      stopPendingRef.current = false
      clearTimer()
    }

    recognition.onend = () => {
      setInterimTranscript('')

      if (shouldRestartRef.current && recognitionRef.current === recognition) {
        // Mobile auto-stop on silence: restart with a FRESH instance so event.results
        // resets cleanly and prior-session results can't duplicate into the new session.
        setTimeout(() => {
          if (shouldRestartRef.current) {
            try {
              const next = createRecognitionRef.current!()
              recognitionRef.current = next
              next.start()
            } catch {
              // Already started or aborted — ignore
            }
          } else if (stopPendingRef.current) {
            // stopRecording was called during the 150 ms restart window — finalize now
            recognitionRef.current = null
            stopPendingRef.current = false
            setState('done')
          }
        }, 150)
      } else if (!shouldRestartRef.current && recognitionRef.current === recognition && stopPendingRef.current) {
        // Intentional stop: all onresult events have already fired, safe to finalize
        recognitionRef.current = null
        stopPendingRef.current = false
        setState('done')
      }
    }

    return recognition
  }, [clearTimer])

  // Keep ref in sync so onend's restart path can call it without a circular dependency
  createRecognitionRef.current = createRecognition

  const startRecording = useCallback(() => {
    if (!isSupported) {
      setError('Voice recording is not supported in this browser.')
      return
    }
    // Guard: prevent starting a second session while one is active
    if (shouldRestartRef.current) return
    try {
      // Abort any lingering instance before creating a fresh one
      try { recognitionRef.current?.abort() } catch { /* ignore */ }
      recognitionRef.current = null

      setError(null)
      setTranscript('')
      setInterimTranscript('')
      setDuration(0)
      accumulatedRef.current = 0
      shouldRestartRef.current = true
      stopPendingRef.current = false

      const recognition = createRecognition()
      recognitionRef.current = recognition
      recognition.start()
      setState('recording')
      startTimer()
    } catch {
      setError('Failed to start recording. Please allow microphone access.')
      setState('error')
      shouldRestartRef.current = false
    }
  }, [isSupported, createRecognition, startTimer])

  const stopRecording = useCallback(() => {
    shouldRestartRef.current = false
    stopPendingRef.current = true
    clearTimer()
    accumulatedRef.current = duration
    setState('processing')
    setInterimTranscript('')
    // Do NOT null recognitionRef here — onend must fire after any final onresult,
    // and it needs recognitionRef === recognition to enter the finalize branch.
    try { recognitionRef.current?.stop() } catch { /* ignore */ }
  }, [clearTimer, duration])

  const pauseRecording = useCallback(() => {
    shouldRestartRef.current = false
    stopPendingRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null  // null immediately so onend is a no-op for this instance
    clearTimer()
    accumulatedRef.current = duration
    setState('paused')
  }, [clearTimer, duration])

  const resumeRecording = useCallback(() => {
    if (shouldRestartRef.current) return  // already recording
    try {
      shouldRestartRef.current = true
      stopPendingRef.current = false
      const recognition = createRecognition()
      recognitionRef.current = recognition
      recognition.start()
      setState('recording')
      startTimer()
    } catch {
      setError('Failed to resume recording.')
      setState('error')
      shouldRestartRef.current = false
    }
  }, [createRecognition, startTimer])

  const resetRecording = useCallback(() => {
    shouldRestartRef.current = false
    stopPendingRef.current = false
    try { recognitionRef.current?.abort() } catch { /* ignore */ }
    recognitionRef.current = null
    clearTimer()
    setTranscript('')
    setInterimTranscript('')
    setDuration(0)
    setError(null)
    setState('idle')
    accumulatedRef.current = 0
  }, [clearTimer])

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false
      stopPendingRef.current = false
      try { recognitionRef.current?.abort() } catch { /* ignore */ }
      recognitionRef.current = null
      clearTimer()
    }
  }, [clearTimer])

  return {
    state, transcript, interimTranscript, duration, error,
    startRecording, stopRecording, pauseRecording, resumeRecording, resetRecording,
    isSupported,
  }
}
