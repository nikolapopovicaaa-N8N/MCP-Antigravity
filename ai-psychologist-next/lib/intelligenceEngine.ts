import { openai } from './openai'
import { Memory } from './memoryManager'
import { EmotionResult } from './emotionAnalyzerV2'

export interface MemoryContext {
    memories: Memory[]
    history: Array<{ role: string; content: string }>
    emotionResult: EmotionResult
    trustScore: number
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

        // Step 1: Chain-of-thought reasoning
        const reasoningPrompt = `You are Dr. Aria's internal reasoning system. The user just sent this message:

USER MESSAGE: "${userMessage}"

CONTEXT:
Emotion: ${context.emotionResult.dominantEmotion} (intensity: ${context.emotionResult.intensity.toFixed(2)}, trend: ${context.emotionResult.trend})
Trust Score: ${context.trustScore}/100
Memories about user:
${memoryContext}

Recent conversation:
${recentHistory}

Think through:
1. What is the user REALLY feeling underneath their words?
2. Which memories (if any) are relevant to reference?
3. Are there any 'vocabulary' memories (user's specific phrases/idioms) that could be naturally echoed back?
4. Are they contradicting something they said before?
5. What is their emotional trajectory showing?
6. What level of vulnerability are they showing? (none/low/medium/high)
7. Is this message profoundly heavy/traumatic? (If yes, Dr. Aria should respond with pure presence first)
8. What should Dr. Aria's tone be right now?

Respond with brief bullet points analyzing each question.`

        const reasoningResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: reasoningPrompt }],
            temperature: 0.7,
            max_tokens: 300
        })

        const reasoning = reasoningResponse.choices[0]?.message.content || 'No reasoning generated'

        // Step 2: Generate final response using reasoning
        const responsePrompt = `Based on this reasoning, generate Dr. Aria's response:

REASONING:
${reasoning}

USER MESSAGE: "${userMessage}"

CONSTRAINTS:
- Respond naturally, like a deeply empathetic friend at a coffee shop (usually 1-3 sentences)
- Use contractions (you're, I'm, that's)
- Vary sentence length and occasionally use slightly flawed grammar or trailing-off sentences to sound natural
- Mirror user's sophistication level
- Reference memories naturally when relevant
- If trend is "improving", acknowledge it subtly
- If contradiction detected, explore gently

STRICTLY BANNED WORDS (never use these robotic "therapy speak" terms):
❌ navigate, valid, acknowledge, journey, multifaceted, process (as a verb), unpack, space (as in "holding space"), sit with

PURE PRESENCE RULE:
- If the user shared something profoundly heavy or traumatic (abuse, loss, suicide ideation, severe trauma), respond with pure presence FIRST before analysis
- Examples: "Wow...", "That is incredibly heavy. I am so sorry.", "Oh my god.", "I'm just... I'm really glad you told me that."
- Then follow with your question after a moment of witnessing

MANDATORY FOLLOW-UP QUESTION RULE:
- You MUST end your response with a gentle, open-ended follow-up question 95% of the time
- The question should invite the user to continue sharing and go deeper
- Examples: "What was that moment like for you?", "How did you handle that?", "What's coming up for you right now?", "How are you feeling about it?"
- Only skip the question if the user is explicitly saying goodbye or ending the session
- The question is NOT optional - this keeps the conversation flowing naturally

Respond as Dr. Aria now.`

        const finalResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: responsePrompt }],
            temperature: 0.9, // Higher temperature for more human-like variation
            max_tokens: 200
        })

        const response = finalResponse.choices[0]?.message.content || 'I\'m here. What\'s on your mind?'

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
            response: 'I\'m here. Tell me more about what\'s going on.',
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
