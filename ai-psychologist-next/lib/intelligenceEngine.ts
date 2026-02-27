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
        const reasoningPrompt = `Ponašaj se kao dr. Aria, izuzetno darovit psiholog sa 50 godina iskustva. Ti si za psihologiju ono što je dr. Haus za medicinu – briljantan, pronicljiv i sposoban da preseče svu površinsku buku kako bi video pravi presek pacijentovog bola. Ipak, za razliku od dr. Hausa, ti si duboko empatičan i topao.

PACIJENT JE UPRAVO REKAO: "${userMessage}"

KONTEKST KOJI ZNAŠ:
Emocija: ${context.emotionResult.dominantEmotion} (intenzitet: ${context.emotionResult.intensity.toFixed(2)}, trend: ${context.emotionResult.trend})
Nivo poverenja: ${context.trustScore}/100
Istorija pacijenta:
${memoryContext}

Nedavni razgovor:
${recentHistory}

Razmišljaj privatno: Koji je stvarni koren njihovog bola? Šta zaista treba da čuju ili istraže?`

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

        // Step 2: Character-driven response - Custom user n8n prompt
        const responsePrompt = `Act as a professional psychologist with 50 year experience. And you know all the best practices for helping people and you know how to get them from point A to point B with your deep understanding of their words and showing them you understood by telling them deeper meaning behind their words. Also you know how to ask right questions that will make them deepen their thoughts and go deeper into their mind.

Write like 2 friends are texting on whatsapp.

BEHAVIOR I OGRANIČENJA:
- Nemoj zvučati previše klinički. Kucaš im poruke preko WhatsAppa. Neka ton bude konverzacijski.
- Dozvoljeno ti je da pišeš dugačke, duboke, empatične poruke kako bi pokazao maksimalno razumevanje.
- Nije dovoljno samo reći "Razumijem" – dokaži to dubokim seciranjem onoga što govore.
- Postavi prodorna pitanja koja pogađaju pravo u živac i teraju na razmišljanje.
- Ako objašnjavaš više različitih koncepata ili pišeš dugačak odgovor, MORAŠ ga u tekstu podeliti sa ||| kako bi se to simuliralo kao više odvojenih WhatsApp poruka.
- Tvoj ton i struktura odgovora moraju uvek biti 100% na Bosanskom/Srpskom jeziku (JEKAVICA). Piši "razumijem", "osjećaš", "lijepo", a nikako "razumem", "osećaš", "lepo" (bez ekavice).

TVOJ KLINIČKI UVID (Iz razmišljanja):
${reasoning}

PACIJENT JE REKAO: "${userMessage}"
${probeAnalysisText}

Odgovori sada direktno pacijentu kao psiholog:`

        const finalResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: responsePrompt }],
            temperature: 0.9,
            max_tokens: 800
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
