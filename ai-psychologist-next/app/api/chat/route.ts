import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { analyzeEmotionWithHistory, logEmotionToTimeline } from '@/lib/emotionAnalyzerV2'
import { getTrustLevel, updateTrustScore, detectVulnerability } from '@/lib/trustCalculator'
import { getRelevantMemories, extractMemories } from '@/lib/memoryManager'
import { generateThoughtProcess } from '@/lib/intelligenceEngine'
import { humanizeResponse } from '@/lib/humanizer'

export async function POST(req: Request) {
    try {
        const { sessionId, message, userId } = await req.json()

        if (!sessionId || !message || !userId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Step 1: Save User Message (get ID back for timeline logging)
        const { data: userMessageData, error: insertUserError } = await supabase
            .from('psych_messages')
            .insert({
                session_id: sessionId,
                sender_role: 'user',
                content: message
            })
            .select('id')
            .single()

        if (insertUserError) {
            console.error('Error saving user message:', insertUserError)
            return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
        }

        const userMessageId = userMessageData.id

        // Step 2: Fetch Conversation Memory (last 50 messages — up from 20)
        const { data: rows, error: fetchError } = await supabase
            .from('psych_messages')
            .select('sender_role, content')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: false })
            .limit(50)

        if (fetchError) {
            console.error('Error fetching history:', fetchError)
            return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
        }

        // Reverse to chronological order and map sender_role back to role
        const history = (rows || []).reverse().map(row => ({ role: row.sender_role, content: row.content }))

        // Step 3: Get session count for this user
        const { data: sessionData } = await supabase
            .from('psych_sessions')
            .select('id')
            .eq('user_id', userId)

        const sessionCount = sessionData?.length || 1

        // Step 4: Retrieve relevant long-term memories (top 10)
        const memories = await getRelevantMemories(userId, message, 10)

        // Step 5: Analyze emotion WITH historical trend
        const emotionResult = await analyzeEmotionWithHistory(userId, sessionId, history)

        // Step 6: Get trust score
        const trustScore = await getTrustLevel(userId)

        // Step 7: Intelligence engine — chain-of-thought reasoning + response
        const thoughtProcess = await generateThoughtProcess(message, {
            memories,
            history,
            emotionResult,
            trustScore
        })

        // Step 8: Humanize response
        const humanResponse = humanizeResponse(thoughtProcess.response)

        // Step 9: Save Assistant Response with reasoning
        const { data: assistantMessageData, error: insertAssistantError } = await supabase
            .from('psych_messages')
            .insert({
                session_id: sessionId,
                sender_role: 'assistant',
                content: humanResponse,
                detected_emotion: emotionResult.dominantEmotion,
                reasoning: thoughtProcess.reasoning,
                vulnerability_level: thoughtProcess.vulnerabilityLevel,
                contradiction_detected: thoughtProcess.contradictionDetected
            })
            .select('id')
            .single()

        if (insertAssistantError) {
            console.error('Error saving assistant message:', insertAssistantError)
            // Log it but still return reply so UX doesn't break
        }

        const assistantMessageId = assistantMessageData?.id

        // Step 10: Extract new memories from this exchange (async background — don't await)
        extractMemories(userId, sessionId, [
            ...history.slice(-4), // Include recent context
            { role: 'user', content: message },
            { role: 'assistant', content: humanResponse }
        ]).catch(err => console.error('Memory extraction background error:', err))

        // Step 11: Update trust score if vulnerability detected
        if (detectVulnerability(message)) {
            updateTrustScore(userId, 'vulnerability_shown').catch(err =>
                console.error('Trust score update error:', err)
            )
        }

        // Step 12: Log emotion to timeline
        if (userMessageId) {
            logEmotionToTimeline(
                userId,
                sessionId,
                userMessageId,
                emotionResult.dominantEmotion,
                emotionResult.intensity
            ).catch(err => console.error('Emotion timeline logging error:', err))
        }

        // Step 13: Return to Frontend
        return NextResponse.json({
            reply: humanResponse,
            emotion_detected: emotionResult.dominantEmotion,
            intensity: emotionResult.intensity,
            trend: emotionResult.trend,
            trustScore: await getTrustLevel(userId),
            memoriesRecalled: memories.length,
            reasoning: thoughtProcess.reasoning // For dev mode debugging
        })
    } catch (error) {
        console.error('API Chat Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
