"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ChatWindow, { Message } from '@/components/ChatWindow'
import ChatInput from '@/components/ChatInput'
import EmotionIndicator from '@/components/EmotionIndicator'
import TrustIndicator from '@/components/TrustIndicator'
import MemoryRecallIndicator from '@/components/MemoryRecallIndicator'
import { Stethoscope } from 'lucide-react'

// Cookie helpers
function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`
}

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [emotion, setEmotion] = useState('neutral')
  const [trend, setTrend] = useState<'improving' | 'worsening' | 'stable' | 'unknown'>('unknown')
  const [trustScore, setTrustScore] = useState(20)
  const [memoriesRecalled, setMemoriesRecalled] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [welcomeBack, setWelcomeBack] = useState(false)

  // Initialize session with cookie persistence
  useEffect(() => {
    async function initSession() {
      try {
        // Check for existing cookie
        let cookieId = getCookie('aria_user_id')
        let user = null

        if (!cookieId) {
          // New user — create cookie
          cookieId = crypto.randomUUID()
          setCookie('aria_user_id', cookieId, 365) // 1 year

          const { data, error: userError } = await supabase
            .from('psych_users')
            .insert({ cookie_id: cookieId })
            .select()
            .single()

          if (userError) throw userError
          user = data
        } else {
          // Returning user — lookup by cookie
          const { data, error: userError } = await supabase
            .from('psych_users')
            .select()
            .eq('cookie_id', cookieId)
            .single()

          if (userError || !data) {
            // Cookie exists but user not found — create new user
            const { data: newUser, error: createError } = await supabase
              .from('psych_users')
              .insert({ cookie_id: cookieId })
              .select()
              .single()

            if (createError) throw createError
            user = newUser
          } else {
            user = data
            setWelcomeBack(true)
          }
        }

        setUserId(user.id)

        // Create new session for this visit
        const { data: session, error: sessionError } = await supabase
          .from('psych_sessions')
          .insert({ user_id: user.id })
          .select()
          .single()

        if (sessionError) throw sessionError
        setSessionId(session.id)

      } catch (err) {
        console.error('Failed to initialize session:', err)
        setError('Dr. Aria is unavailable right now. Please try again later.')
      }
    }

    initSession()
  }, [])

  const handleSend = async (content: string) => {
    if (!sessionId || !userId) {
      console.error('Session or User ID is missing', { sessionId, userId });
      setError('Session connection error. Please refresh the page.');
      return;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content
    }

    setMessages(prev => [...prev, userMessage])
    setError(null)

    // Feature 2: Dynamic "Cognitive Delay" based on message length
    // Calculate reading delay: ~200ms per word, capped at 4500ms
    const wordCount = content.trim().split(/\s+/).length
    const readingDelay = Math.min(wordCount * 200, 4500)

    // Delay before showing typing indicator (simulates "reading" the message)
    await new Promise(resolve => setTimeout(resolve, readingDelay))

    // Now show typing indicator
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: content, userId })
      })

      if (!res.ok) {
        throw new Error('API request failed')
      }

      const data = await res.json()

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply
      }

      setMessages(prev => [...prev, assistantMessage])

      // Update v2.0 state
      if (data.emotion_detected) {
        setEmotion(data.emotion_detected)
      }
      if (data.trend) {
        setTrend(data.trend)
      }
      if (typeof data.trustScore === 'number') {
        setTrustScore(data.trustScore)
      }
      if (typeof data.memoriesRecalled === 'number') {
        setMemoriesRecalled(data.memoriesRecalled)
      }
    } catch (err) {
      console.error('Chat error:', err)
      setError('Dr. Aria is unavailable right now. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex flex-col h-screen max-h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-semibold text-lg text-slate-900 leading-tight">Dr. Aria</h1>
            <p className="text-sm text-slate-500 font-medium">
              AI Clinical Psychologist {welcomeBack && <span className="text-blue-600">• Welcome back</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <EmotionIndicator emotion={emotion} trend={trend} />
          <TrustIndicator trustScore={trustScore} />
        </div>
      </header>

      {/* Chat Area */}
      <ChatWindow messages={messages} isLoading={isLoading} />

      {/* Input Area */}
      <div className="bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] shadow-slate-200/50 z-10 w-full shrink-0 relative">
        <div className="p-4 sm:p-6 mx-auto max-w-4xl w-full">
          {error && (
            <div className="mb-3 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-center justify-center animate-in fade-in duration-300">
              {error}
            </div>
          )}
          {memoriesRecalled > 0 && (
            <div className="mb-3">
              <MemoryRecallIndicator count={memoriesRecalled} />
            </div>
          )}
          <ChatInput onSend={handleSend} disabled={isLoading || !sessionId} />
          <div className="text-center mt-3">
            <p className="text-xs text-slate-400 font-medium">
              This is an AI assistant for demonstration purposes. In a real crisis, please contact emergency services.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
