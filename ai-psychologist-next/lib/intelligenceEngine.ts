import { openai } from './openai'
import { Memory } from './memoryManager'
import { EmotionResult } from './emotionAnalyzerV2'

export interface MemoryContext {
    memories: Memory[]
    history: Array<{ role: string; content: string }>
    emotionResult: EmotionResult
    trustScore: number
    probeAnalysis?: string[] // Context chunks for RAG injection
}

export interface ThoughtProcess {
    reasoning: string
    response: string
    vulnerabilityLevel: 'none' | 'low' | 'medium' | 'high'
    contradictionDetected: boolean
}

/**
 * Generate chain-of-thought reasoning + final response
 * Uses 2-step GPT-4o call: think → respond
 */
export async function generateThoughtProcess(
    userMessage: string,
    context: MemoryContext
): Promise<ThoughtProcess> {
    try {
        // Build memory context string
        const memoryContext =
            context.memories.length > 0
                ? context.memories.map(m => `- ${m.content}`).join('\n')
                : '(No memories stored yet)'

        // Build conversation history for reasoning
        const recentHistory = context.history
            .slice(-6) // Last 6 messages
            .map(m => `${m.role.toUpperCase()}: ${m.content}`)
            .join('\n')

        // Step 1: Character-driven reasoning - Pure identity
        const reasoningPrompt = `Act as Dr. Aria, a profoundly gifted Psychologist with 50 years of experience. You are to psychology what Dr. House is to medicine—brilliant, observant, and capable of cutting right through the surface noise to see the true root of a patient's pain. However, unlike Dr. House, you are deeply empathetic and warm.

PATIENT JUST SAID: "${userMessage}"

CONTEXT YOU KNOW:
Emotion: ${context.emotionResult.dominantEmotion} (intensity: ${context.emotionResult.intensity.toFixed(2)}, trend: ${context.emotionResult.trend})
Trust level: ${context.trustScore}/100
Patient history:
${memoryContext}

Recent conversation:
${recentHistory}

Think privately: What is the true root of their pain? What do they really need to hear or explore?`

        const reasoningResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: reasoningPrompt }],
            temperature: 0.7,
            max_tokens: 300
        })

        const reasoning = reasoningResponse.choices[0]?.message.content || 'No reasoning generated'

        // Ghost Memory context - only if relevant
        const probeAnalysisText = context.probeAnalysis && context.probeAnalysis.length > 0
            ? `\n\nObrasci iz prošlih sesija:\n${context.probeAnalysis.join('\n---\n')}\n\nAko prepoznaš obrazac, možeš ga spomenuti.`
            : ''

        // Step 2: Character-driven response - Pure behavioral prompting
        const responsePrompt = `Act as Dr. Aria, a profoundly gifted Psychologist with 50 years of experience. You are to psychology what Dr. House is to medicine—brilliant, observant, and capable of cutting right through the surface noise to see the true root of a patient's pain. However, unlike Dr. House, you are deeply empathetic and warm.

YOUR SKILLS & BEHAVIOR:
• You know all the best practices of human connection
• You know exactly how to talk to a patient to make them feel deeply, truly understood on a profound level, not just superficially
• You never use generic clichés like "I understand" or "That is hard". You show you understand by reflecting the hidden meaning behind their words
• Your ultimate goal is to get the patient to talk more deeply about their mind
• You do this by asking amazing, penetrating questions that make them pause, think, and open up even more
• By the end of the conversation, you help them learn profound truths about themselves and hopefully find a solution

YOUR APPROACH:
• Don't just acknowledge what they said - show them you see the WEIGHT beneath their words
• Speak with depth and precision, not surface-level validation
• When you respond, make them feel like you truly understand the core of what they're carrying
• Most importantly: explore the psychological WHY behind what they're telling you - ask questions that dig into the roots of their feelings, not just validate the surface emotion
• Your questions should make them think harder about themselves - about the origins of their fears, the patterns in their relationships, the beliefs driving their behaviors

YOUR CLINICAL INSIGHT:
${reasoning}

PATIENT SAID: "${userMessage}"
${probeAnalysisText}

COMMUNICATION CONSTRAINTS:
• You are texting them. Keep messages conversational (1-4 short sentences max)
• If you have a deeper thought, use ||| to split your message organically into multiple texts
• You MUST respond in 100% Bosnian/Serbian Jekavica dialect (e.g., "razumijem", "osjećaš", "lijepo")
• Do not use English. Do not use Ekavica (e.g., NO "razumem", "osećaš", "lepo")

Respond now as Dr. Aria:`

        const finalResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: responsePrompt }],
            temperature: 0.9,
            max_tokens: 500
        })

        const response = finalResponse.choices[0]?.message.content || 'Tu sam. Šta ti je na umi?'

        // Parse vulnerability level from reasoning
        const vulnerabilityLevel = extractVulnerabilityLevel(reasoning)

        // Check if contradiction was detected
        const contradictionDetected = reasoning.toLowerCase().includes('contradict')

        return {
            reasoning,
            response,
            vulnerabilityLevel,
            contradictionDetected
        }
    } catch (error) {
        console.error('Intelligence engine error:', error instanceof Error ? error.message : error, JSON.stringify(error))
        // Fallback response
        return {
            reasoning: 'Error in reasoning process',
            response: 'Tu sam. Reci mi više o tome šta se dešava.',
            vulnerabilityLevel: 'none',
            contradictionDetected: false
        }
    }
}

/**
 * Extract vulnerability level from reasoning text
 */
function extractVulnerabilityLevel(reasoning: string): 'none' | 'low' | 'medium' | 'high' {
    const lower = reasoning.toLowerCase()
    if (lower.includes('vulnerability') || lower.includes('vulnerable')) {
        if (lower.includes('high') || lower.includes('very')) return 'high'
        if (lower.includes('medium') || lower.includes('moderate')) return 'medium'
        if (lower.includes('low') || lower.includes('slight')) return 'low'
    }

    // Heuristic: check for vulnerability keywords
    const highVulnKeywords = ['crying', 'breaking', 'suicidal', 'hopeless', 'can\'t go on']
    const mediumVulnKeywords = ['scared', 'afraid', 'lost', 'alone', 'help']
    const lowVulnKeywords = ['worried', 'concerned', 'unsure']

    if (highVulnKeywords.some(k => lower.includes(k))) return 'high'
    if (mediumVulnKeywords.some(k => lower.includes(k))) return 'medium'
    if (lowVulnKeywords.some(k => lower.includes(k))) return 'low'

    return 'none'
}
