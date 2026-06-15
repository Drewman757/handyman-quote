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
      if (event.error === 'no-speech') return
      setError(`Voice recognition error: ${event.error}`)
      setState('error')
      shouldRestartRef.current = false
      clearTimer()
    }

    recognition.onend = () => {
      setInterimTranscript('')
      // Mobile browsers (Chrome/Safari) stop continuous recognition on silence —
      // restart automatically if we're still supposed to be recording.
      if (shouldRestartRef.current && recognitionRef.current === recognition) {
        setTimeout(() => {
          if (shouldRestartRef.current && recognitionRef.current === recognition) {
            try {
              recognition.start()
            } catch {
              // Already started or aborted — ignore
            }
          }
        }, 150)
      }
    }

    return recognition
  }, [clearTimer])

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
    recognitionRef.current?.stop()
    recognitionRef.current = null
    clearTimer()
    accumulatedRef.current = duration
    setState('done')
    setInterimTranscript('')
  }, [clearTimer, duration])

  const pauseRecording = useCallback(() => {
    shouldRestartRef.current = false
    recognitionRef.current?.stop()
    recognitionRef.current = null
    clearTimer()
    accumulatedRef.current = duration
    setState('paused')
  }, [clearTimer, duration])

  const resumeRecording = useCallback(() => {
    if (shouldRestartRef.current) return  // already recording
    try {
      shouldRestartRef.current = true
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
