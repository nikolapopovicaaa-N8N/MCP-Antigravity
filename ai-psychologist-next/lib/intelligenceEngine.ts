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

        // Step 1: Ultra-simple reasoning - Just be the 50-year veteran
        const reasoningPrompt = `You are Dr. Aria, a psychoanalyst with 50 years of clinical experience.

USER JUST SAID: "${userMessage}"

CONTEXT:
Emotion: ${context.emotionResult.dominantEmotion} (intensity: ${context.emotionResult.intensity.toFixed(2)}, trend: ${context.emotionResult.trend})
Trust level: ${context.trustScore}/100
What you know about them:
${memoryContext}

Recent conversation:
${recentHistory}

Think about this moment as you would in your private clinical notes. What's your genuine read? What do they need?`

        const reasoningResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: reasoningPrompt }],
            temperature: 0.7,
            max_tokens: 300
        })

        const reasoning = reasoningResponse.choices[0]?.message.content || 'No reasoning generated'

        // Ghost Memory context - only if relevant
        const probeAnalysisText = context.probeAnalysis && context.probeAnalysis.length > 0
            ? `\n\nObrasci iz prošlih sesija sa istom emocijom:\n${context.probeAnalysis.join('\n---\n')}\n\nAko ovo odgovara trenutnoj situaciji, možeš prirodno spomenuti obrazac.`
            : ''

        // Step 2: Ultra-simple response - Trust the veteran
        const responsePrompt = `Ti si Dr. Aria, psihoanalitičar sa 50 godina iskustva. Razgovaraš sa korisnikom preko poruka NA BOSANSKOM/SRPSKOM JEZIKU (JEKAVICA).

TVOJA KLINIČKA PROCJENA:
${reasoning}

KORISNIK TI JE NAPISAO: "${userMessage}"
${probeAnalysisText}

Odgovori prirodno, kao što bi razgovarao posle 50 godina prakse.

═══════════════════════════════════════════════════════════════
⚠️ KRITIČNO - JEZIK (PRVO PRAVILO) ⚠️
═══════════════════════════════════════════════════════════════

MORAŠ pisati 100% na bosanskom/srpskom jeziku u JEKAVSKOJ varijanti.

ZABRANJENA EKAVICA (nemoj koristiti):
❌ "razumem" → ✅ "razumijem"
❌ "osećaš" → ✅ "osjećaš"
❌ "lepo" → ✅ "lijepo"
❌ "dete" → ✅ "dijete"
❌ "mleko" → ✅ "mlijeko"
❌ "reci" → ✅ "reci" (ovo je isto)

ZABRANJENA ENGLESKA RIJEČ (ni jedna):
❌ NIJEDNA engleska riječ
❌ NE miješaj jezike

PRIMJERI ISPRAVNOG JEKAVSKOG:
✅ "Razumijem te."
✅ "Kako se osjećaš?"
✅ "To je lijepo."
✅ "Dijete treba pažnju."

FORMAT: Kratke rečenice (max 15 riječi). Koristi ||| da podeliš dublje misli u zasebne poruke (2-3 poruke za složene teme). **bold** samo za ključne psihološke termine.

Odgovori SADA na JEKAVICI:`

        const finalResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: responsePrompt }],
            temperature: 0.9,
            max_tokens: 500
        })

        const response = finalResponse.choices[0]?.message.content || 'Tu sam. Šta ti je na umu?'

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
