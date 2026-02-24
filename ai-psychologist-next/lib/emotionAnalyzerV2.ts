import { supabase } from './supabase'
import { analyzeEmotion } from './emotionAnalyzer'

export interface EmotionResult {
    dominantEmotion: string
    intensity: number
    trend: 'improving' | 'worsening' | 'stable' | 'unknown'
    baseline: { emotion: string; avgIntensity: number } | null
}

export interface Message {
    role: string
    content: string
}

/**
 * Analyze emotion with historical trend awareness
 * Compares current emotion vs. user's 30-day baseline
 */
export async function analyzeEmotionWithHistory(
    userId: string,
    sessionId: string,
    currentMessages: Message[]
): Promise<EmotionResult> {
    // Step 1: Get current emotion using existing analyzer
    const currentEmotion = analyzeEmotion(currentMessages)

    try {
        // Step 2: Fetch user's emotion history (last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: history, error } = await supabase
            .from('emotion_timeline')
            .select('emotion, intensity, timestamp')
            .eq('user_id', userId)
            .gte('timestamp', thirtyDaysAgo.toISOString())
            .order('timestamp', { ascending: true })

        if (error || !history || history.length === 0) {
            // No history — return current emotion with 'unknown' trend
            return {
                dominantEmotion: currentEmotion.dominantEmotion,
                intensity: currentEmotion.intensity,
                trend: 'unknown',
                baseline: null
            }
        }

        // Step 3: Calculate baseline (most common emotion + average intensity)
        const emotionCounts: Record<string, number> = {}
        const emotionIntensities: Record<string, number[]> = {}

        history.forEach(entry => {
            emotionCounts[entry.emotion] = (emotionCounts[entry.emotion] || 0) + 1
            if (!emotionIntensities[entry.emotion]) {
                emotionIntensities[entry.emotion] = []
            }
            emotionIntensities[entry.emotion].push(entry.intensity)
        })

        // Find dominant baseline emotion
        let baselineEmotion = 'neutral'
        let maxCount = 0
        for (const [emotion, count] of Object.entries(emotionCounts)) {
            if (count > maxCount) {
                maxCount = count
                baselineEmotion = emotion
            }
        }

        // Calculate average intensity for baseline emotion
        const baselineIntensities = emotionIntensities[baselineEmotion] || [0]
        const avgIntensity =
            baselineIntensities.reduce((a, b) => a + b, 0) / baselineIntensities.length

        // Step 4: Determine trend
        let trend: 'improving' | 'worsening' | 'stable' | 'unknown' = 'stable'

        // Negative emotions: anxious, sad, angry, confused
        const negativeEmotions = ['anxious', 'sad', 'angry', 'confused']
        // Positive emotions: calm, hopeful
        const positiveEmotions = ['calm', 'hopeful']

        const currentIsNegative = negativeEmotions.includes(currentEmotion.dominantEmotion)
        const baselineIsNegative = negativeEmotions.includes(baselineEmotion)

        if (currentIsNegative && baselineIsNegative) {
            // Both negative — compare intensity
            if (currentEmotion.intensity < avgIntensity - 0.15) {
                trend = 'improving'
            } else if (currentEmotion.intensity > avgIntensity + 0.15) {
                trend = 'worsening'
            }
        } else if (!currentIsNegative && baselineIsNegative) {
            // Moved from negative to positive/neutral
            trend = 'improving'
        } else if (currentIsNegative && !baselineIsNegative) {
            // Moved from positive to negative
            trend = 'worsening'
        } else if (positiveEmotions.includes(currentEmotion.dominantEmotion) && positiveEmotions.includes(baselineEmotion)) {
            // Both positive — stable is good
            trend = 'stable'
        }

        return {
            dominantEmotion: currentEmotion.dominantEmotion,
            intensity: currentEmotion.intensity,
            trend,
            baseline: {
                emotion: baselineEmotion,
                avgIntensity
            }
        }
    } catch (error) {
        console.error('Emotion history analysis error:', error)
        return {
            dominantEmotion: currentEmotion.dominantEmotion,
            intensity: currentEmotion.intensity,
            trend: 'unknown',
            baseline: null
        }
    }
}

/**
 * Log emotion to timeline for future trend analysis
 */
export async function logEmotionToTimeline(
    userId: string,
    sessionId: string,
    messageId: string,
    emotion: string,
    intensity: number
): Promise<void> {
    try {
        await supabase.from('emotion_timeline').insert({
            user_id: userId,
            session_id: sessionId,
            message_id: messageId,
            emotion,
            intensity
        })
    } catch (error) {
        console.error('Emotion timeline logging error:', error)
    }
}
