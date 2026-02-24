import { supabase } from './supabase'

export type TrustEvent =
    | 'vulnerability_shown'
    | 'session_completed'
    | 'contradiction_detected'
    | 'long_pause'
    | 'deep_question_answered'
    | 'resistance_shown'

const TRUST_DELTA: Record<TrustEvent, number> = {
    vulnerability_shown: 5,
    session_completed: 2,
    contradiction_detected: -3,
    long_pause: -1, // User disappeared mid-session
    deep_question_answered: 3,
    resistance_shown: -2
}

/**
 * Get user's current trust score
 * Returns 20 (stranger) if no score exists
 */
export async function getTrustLevel(userId: string): Promise<number> {
    try {
        const { data, error } = await supabase
            .from('trust_score')
            .select('score')
            .eq('user_id', userId)
            .single()

        if (error || !data) {
            // Initialize trust score for new user
            await supabase.from('trust_score').insert({
                user_id: userId,
                score: 20,
                factors: {}
            })
            return 20
        }

        return data.score
    } catch (error) {
        console.error('Get trust level error:', error)
        return 20
    }
}

/**
 * Update trust score based on an event
 * Returns new score after update
 */
export async function updateTrustScore(userId: string, event: TrustEvent): Promise<number> {
    try {
        // Get current score
        const currentScore = await getTrustLevel(userId)

        // Calculate delta
        const delta = TRUST_DELTA[event] || 0

        // New score (clamped 0-100)
        const newScore = Math.max(0, Math.min(100, currentScore + delta))

        // Update factors JSONB (track event counts)
        const { data: existing } = await supabase
            .from('trust_score')
            .select('factors')
            .eq('user_id', userId)
            .single()

        const factors = existing?.factors || {}
        factors[event] = (factors[event] || 0) + 1

        // Save
        await supabase
            .from('trust_score')
            .update({
                score: newScore,
                last_updated: new Date().toISOString(),
                factors
            })
            .eq('user_id', userId)

        return newScore
    } catch (error) {
        console.error('Update trust score error:', error)
        return await getTrustLevel(userId)
    }
}

/**
 * Get trust level as human-readable label
 */
export function getTrustLabel(score: number): string {
    if (score < 20) return 'Distrust'
    if (score < 40) return 'Stranger'
    if (score < 60) return 'Acquaintance'
    if (score < 80) return 'Trusted'
    return 'Deep Alliance'
}

/**
 * Detect vulnerability in user message
 * Returns true if message shows emotional vulnerability
 */
export function detectVulnerability(message: string): boolean {
    const vulnerabilityMarkers = [
        'i feel',
        'i\'m scared',
        'i\'m afraid',
        'i\'m worried',
        'i can\'t',
        'i don\'t know',
        'help me',
        'i\'m lost',
        'i hate myself',
        'i\'m crying',
        'nobody',
        'alone',
        'ashamed',
        'embarrassed',
        'failed',
        'broken'
    ]

    const lowerMessage = message.toLowerCase()
    return vulnerabilityMarkers.some(marker => lowerMessage.includes(marker))
}
