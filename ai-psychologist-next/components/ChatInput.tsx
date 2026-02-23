"use client"

import { useState, KeyboardEvent, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'

interface ChatInputProps {
    onSend: (message: string) => void
    disabled: boolean
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
    const [input, setInput] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const handleSend = () => {
        if (input.trim() && !disabled) {
            onSend(input.trim())
            setInput('')
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto'
            }
        }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
        }
    }, [input])

    return (
        <div className="relative flex items-end w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-1 transition-all focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50">
            <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                placeholder="Type your message..."
                className="w-full max-h-[120px] bg-transparent resize-none outline-none py-3 px-4 text-slate-800 placeholder:text-slate-400 text-[15px] sm:text-base disabled:opacity-50"
                rows={1}
            />
            <button
                onClick={handleSend}
                disabled={disabled || !input.trim()}
                className="p-2 mb-1 mr-1 rounded-xl bg-blue-600 text-white disabled:bg-slate-100 disabled:text-slate-400 transition-colors flex-shrink-0"
            >
                <Send className="w-5 h-5" />
            </button>
        </div>
    )
}
