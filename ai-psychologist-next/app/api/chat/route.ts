import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { openai } from '@/lib/openai'
import { analyzeEmotion } from '@/lib/emotionAnalyzer'
import { buildSystemPrompt } from '@/lib/promptBuilder'

export async function POST(req: Request) {
    try {
        const { sessionId, message } = await req.json()

        if (!sessionId || !message) {
            return NextResponse.json({ error: 'Missing sessionId or message' }, { status: 400 })
        }

        // Step 1: Save User Message
        const { error: insertUserError } = await supabase.from('psych_messages').insert({
            session_id: sessionId,
            role: 'user',
            content: message
        })

        if (insertUserError) {
            console.error('Error saving user message:', insertUserError)
            return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
        }

        // Step 2: Fetch Conversation Memory (last 20 messages)
        const { data: rows, error: fetchError } = await supabase
            .from('psych_messages')
            .select('role, content')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(20)

        if (fetchError) {
            console.error('Error fetching history:', fetchError)
            return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
        }

        // Reverse to chronological order for OpenAI
        const history = (rows || []).reverse()

        // Convert to OpenAI format
        const openaiHistory = history.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content
        }))

        // Step 3: Emotional State Analysis
        const emotionResult = analyzeEmotion(history)

        // Step 4: Build Dynamic System Prompt
        const systemPrompt = buildSystemPrompt(emotionResult.dominantEmotion, emotionResult.intensity)

        // Step 5: OpenAI Call with Structured Output
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                ...openaiHistory
            ],
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'psychologist_response',
                    schema: {
                        type: 'object',
                        properties: {
                            reply: { type: 'string' },
                            emotion_detected: {
                                type: 'string',
                                enum: ['anxious', 'sad', 'angry', 'calm', 'confused', 'hopeful', 'neutral']
                            }
                        },
                        required: ['reply', 'emotion_detected'],
                        additionalProperties: false
                    },
                    strict: true
                }
            }
        })

        const responseContent = response.choices[0]?.message.content
        if (!responseContent) {
            throw new Error('No content returned from OpenAI')
        }

        const parsed = JSON.parse(responseContent)

        // Make sure we have the required fields
        if (!parsed.reply || !parsed.emotion_detected) {
            throw new Error('Invalid JSON structure returned from OpenAI')
        }

        // Step 6: Save Assistant Response
        const { error: insertAssistantError } = await supabase.from('psych_messages').insert({
            session_id: sessionId,
            role: 'assistant',
            content: parsed.reply,
            detected_emotion: parsed.emotion_detected
        })

        if (insertAssistantError) {
            console.error('Error saving assistant message:', insertAssistantError)
            // Log it but still return reply so UX doesn't break
        }

        // Step 7: Return to Frontend
        return NextResponse.json({
            reply: parsed.reply,
            emotion_detected: parsed.emotion_detected,
            intensity: emotionResult.intensity
        })
    } catch (error) {
        console.error('API Chat Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
