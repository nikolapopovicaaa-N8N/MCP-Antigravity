"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ChatWindow, { Message } from '@/components/ChatWindow'
import ChatInput from '@/components/ChatInput'
import EmotionIndicator from '@/components/EmotionIndicator'
import { Stethoscope } from 'lucide-react'

export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [emotion, setEmotion] = useState('neutral')
  const [error, setError] = useState<string | null>(null)

  // Initialize session
  useEffect(() => {
    async function initSession() {
      try {
        // 1. Create User
        const { data: user, error: userError } = await supabase
          .from('psych_users')
          .insert({})
          .select()
          .single()

        if (userError) throw userError

        // 2. Create Session
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
    if (!sessionId) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: content })
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
      if (data.emotion_detected) {
        setEmotion(data.emotion_detected)
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
            <p className="text-sm text-slate-500 font-medium">AI Clinical Psychologist</p>
          </div>
        </div>
        <EmotionIndicator emotion={emotion} />
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
