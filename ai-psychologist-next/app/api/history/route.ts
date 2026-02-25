import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const userId = searchParams.get('userId')

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
        }

        // Fetch the user's most recent session
        const { data: sessionData, error: sessionError } = await supabase
            .from('psych_sessions')
            .select('id')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (sessionError || !sessionData) {
            // No session found - new user, return empty history
            return NextResponse.json({ messages: [] })
        }

        const sessionId = sessionData.id

        // Fetch last 50 messages for this session
        const { data: messages, error: messagesError } = await supabase
            .from('psych_messages')
            .select('id, sender_role, content, created_at')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true }) // Chronological order (oldest first)
            .limit(50)

        if (messagesError) {
            console.error('Error fetching message history:', messagesError)
            return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
        }

        // Map database format to frontend format
        const formattedMessages = (messages || []).map(msg => ({
            id: msg.id,
            role: msg.sender_role, // 'user' or 'assistant'
            content: msg.content
        }))

        return NextResponse.json({ messages: formattedMessages })
    } catch (error) {
        console.error('History API Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
