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

// Augment window for browser Speech Recognition API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = useState<RecordingState>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const accumulatedRef = useRef<number>(0)

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
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onresult = (event: SpeechRecognitionEvent) => {
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

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') return
      setError(`Voice recognition error: ${event.error}`)
      setState('error')
      clearTimer()
    }

    recognition.onend = () => setInterimTranscript('')

    return recognition
  }, [clearTimer])

  const startRecording = useCallback(() => {
    if (!isSupported) {
      setError('Voice recording is not supported in this browser.')
      return
    }
    try {
      setError(null)
      setTranscript('')
      setInterimTranscript('')
      setDuration(0)
      accumulatedRef.current = 0
      const recognition = createRecognition()
      recognitionRef.current = recognition
      recognition.start()
      setState('recording')
      startTimer()
    } catch {
      setError('Failed to start recording. Please allow microphone access.')
      setState('error')
    }
  }, [isSupported, createRecognition, startTimer])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    clearTimer()
    accumulatedRef.current = duration
    setState('done')
    setInterimTranscript('')
  }, [clearTimer, duration])

  const pauseRecording = useCallback(() => {
    recognitionRef.current?.stop()
    clearTimer()
    accumulatedRef.current = duration
    setState('paused')
  }, [clearTimer, duration])

  const resumeRecording = useCallback(() => {
    try {
      const recognition = createRecognition()
      recognitionRef.current = recognition
      recognition.start()
      setState('recording')
      startTimer()
    } catch {
      setError('Failed to resume recording.')
      setState('error')
    }
  }, [createRecognition, startTimer])

  const resetRecording = useCallback(() => {
    recognitionRef.current?.stop()
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
      recognitionRef.current?.stop()
      clearTimer()
    }
  }, [clearTimer])

  return {
    state, transcript, interimTranscript, duration, error,
    startRecording, stopRecording, pauseRecording, resumeRecording, resetRecording,
    isSupported,
  }
}
