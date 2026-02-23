import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

// Initialize client inside the component to avoid module scope strict errors

const WEBHOOK_URL = 'https://n8n.srv958405.hstgr.cloud/webhook/psych-chat';

type Message = {
  id: string;
  sender_role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export default function App() {
  // Safe environment variable initialization
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  // We useRef to keep a single instance of the client
  const supabase = useRef(
    supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null
  ).current;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // App State Details
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial Setup: Create User and Session in Supabase
  useEffect(() => {
    async function initializeSession() {
      if (!supabaseUrl || !supabaseKey) {
        setSetupError('Missing Supabase credentials in .env file.');
        return;
      }

      try {
        // 1. Check if we already have a generated user ID in local storage
        let currentUserId = localStorage.getItem('psych_user_id');

        if (!currentUserId) {
          // In a real app with auth, you'd get this from the logged-in user.
          // For now, we generate a UUID for an anonymous user.
          currentUserId = uuidv4();

          // Only psych_users requires actual creation. 
          // If we are using extensions.uuid_generate_v4(), it expects a valid UUID.
          const { error: userError } = await supabase!
            .from('psych_users')
            .insert([{ id: currentUserId }]);

          if (userError) throw userError;
          localStorage.setItem('psych_user_id', currentUserId);
        }

        // 2. Create a new session for this chat session
        const newSessionId = uuidv4();
        const { error: sessionError } = await supabase!
          .from('psych_sessions')
          .insert([{ id: newSessionId, user_id: currentUserId }]);

        if (sessionError) throw sessionError;
        setSessionId(newSessionId);

        // Optionally, load any welcome message here
        setMessages([
          {
            id: uuidv4(),
            sender_role: 'assistant',
            content: "Hello. I'm here to listen. How are you feeling today?",
            created_at: new Date().toISOString(),
          }
        ]);

      } catch (err: any) {
        console.error('Error initializing session:', err);
        setSetupError(err.message || 'Failed to initialize chat session.');
      }
    }

    initializeSession();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !sessionId) return;

    const userMessage: Message = {
      id: uuidv4(),
      sender_role: 'user',
      content: input,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // IMPORTANT: Payload matching what n8n expects
        body: JSON.stringify({
          sessionId: sessionId,
          message: userMessage.content,
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.statusText}`);
      }

      // n8n returns the response JSON from the OpenAI node
      const data = await response.json();

      // Let's assume the node just returns the text content under data.message.content
      // Adjust this based on exactly what your n8n last node returns!
      const aiReply = typeof data === 'string'
        ? data
        : data?.message?.content || data?.content || JSON.stringify(data);

      const aiMessage: Message = {
        id: uuidv4(),
        sender_role: 'assistant',
        content: aiReply,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          sender_role: 'assistant',
          content: "I'm sorry, I'm having trouble connecting right now. Please try again later.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (setupError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg shadow max-w-md text-center">
          <h2 className="font-semibold mb-2">Setup Error</h2>
          <p>{setupError}</p>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-slate-500">Initializing your private session...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 md:py-8 md:px-4">
      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto bg-white md:rounded-2xl md:shadow-sm overflow-hidden border border-slate-100">

        {/* Header */}
        <header className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 p-2 rounded-full">
              <Bot className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-800">AI Psychologist</h1>
              <p className="text-xs text-slate-500">Confidential Space</p>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {messages.map((message) => {
            const isUser = message.sender_role === 'user';
            return (
              <div
                key={message.id}
                className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                >
                  {isUser ? (
                    <User className="w-5 h-5 text-white" />
                  ) : (
                    <Bot className="w-5 h-5 text-slate-600" />
                  )}
                </div>

                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-3 ${isUser
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-white text-slate-700 border border-slate-100 shadow-sm rounded-tl-none'
                    }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex gap-4 flex-row">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                <Bot className="w-5 h-5 text-slate-600" />
              </div>
              <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-tl-none px-5 py-4 flex items-center gap-2">
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100">
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 bg-slate-50 px-4 py-3 rounded-full border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 bg-transparent border-none focus:outline-none text-slate-700 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2 text-white bg-indigo-600 rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <p className="text-center text-xs text-slate-400 mt-3 font-medium">
            AI can make mistakes. Please consider seeking professional help for serious issues.
          </p>
        </div>

      </main>
    </div>
  );
}
