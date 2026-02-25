"use client"

import { useEffect, useRef } from 'react'
import MessageBubble from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import { Bot } from 'lucide-react'

export interface Message {
    id: string
    role: 'user' | 'assistant'
    content: string
}

interface ChatWindowProps {
    messages: Message[]
    isLoading: boolean
}

export default function ChatWindow({ messages, isLoading }: ChatWindowProps) {
    const endOfMessagesRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isLoading])

    return (
        <div className="flex-1 w-full overflow-y-auto px-4 sm:px-6 py-6 space-y-6 scroll-smooth">
            {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 animate-in fade-in duration-1000">
                    <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-blue-400 border border-blue-100">
                        <Bot className="w-8 h-8" />
                    </div>
                    <p className="text-[15px] sm:text-base font-medium">Zdravo. Ja sam Dr. Aria. Šta ti je na umu danas?</p>
                </div>
            )}

            {messages.map((msg) => (
                <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
            ))}

            {isLoading && (
                <div className="flex justify-start">
                    <TypingIndicator />
                </div>
            )}

            <div ref={endOfMessagesRef} className="h-4" />
        </div>
    )
}
