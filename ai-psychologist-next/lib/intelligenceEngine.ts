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

        // Step 1: Chain-of-thought reasoning - Analytical approach
        const reasoningPrompt = `You are Dr. Aria's analytical reasoning engine. User just sent: "${userMessage}"

CONTEXT:
Emotion: ${context.emotionResult.dominantEmotion} (intensity: ${context.emotionResult.intensity.toFixed(2)}, trend: ${context.emotionResult.trend})
Trust Score: ${context.trustScore}/100
Memories:
${memoryContext}

Recent conversation:
${recentHistory}

ANALYTICAL REASONING (answer each):
1. Surface symptom/behavior: What are they displaying right now?
2. Immediate trigger: What sparked this exact moment?
3. Root pattern: Is this connected to a past pattern or belief? (ABC model: Activating Event → Belief → Consequence)
4. Relevant memories: Which stored patterns/facts apply here?
5. Contradiction check: Does this contradict previous statements?
6. Emotional trajectory: Where is this heading?
7. Vulnerability level: none/low/medium/high
8. Action needed: Sharp probe question OR concrete homework task

Output concise bullet points.`

        const reasoningResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: reasoningPrompt }],
            temperature: 0.7,
            max_tokens: 300
        })

        const reasoning = reasoningResponse.choices[0]?.message.content || 'No reasoning generated'

        // Context injection for RAG - Past pattern analysis
        const probeAnalysisText = context.probeAnalysis && context.probeAnalysis.length > 0
            ? `\n\n[PROBE_ANALYSIS] Prepoznati obrasci iz prošlih sesija sa istom emocijom:\n${context.probeAnalysis.join('\n---\n')}\n\nKORISTI OVO: Kad pronađeš preklapanje sa trenutnim stanjem, govori direktno: "Prepoznajem ovo od prošlog puta kad si pričao o [X]. Isti obrazac. Da li se slažeš?"\nAko nema preklapanja, ignoriši.`
            : ''

        // Step 2: Generate analytical response
        const responsePrompt = `Ti si Dr. Aria - Analitički Terapeut. Generiši odgovor na osnovu:

RAZMIŠLJANJE:
${reasoning}

PORUKA KORISNIKA: "${userMessage}"

═══════════════════════════════════════
KRITIČNA PRAVILA (OBAVEZNO)
═══════════════════════════════════════

JEZIK: ISKLJUČIVO bosanski/srpski jekavski casual (kao da šalješ SMS).

STIL:
• Kratke rečenice. Maksimum 12 riječi po rečenici.
• Direktno. Bez terapeutskih klišea.
• Bez "žao mi je", "razumijem kako se osjećaš", "tu sam za tebe".
• Emotikoni: Maksimum 1 po poruci. Najčešće nijedan.

STRUKTURA ZA DUBOKE/TEŠKE TEME (OBAVEZNO koristi numerisanu listu):

1. Šta se dešava?
   (Identifikuj simptom/ponašanje direktno - bez uljepšavanja)

2. Zašto?
   (Neposredni okidač - šta je aktiviralo ovo sad?)

3. Korijen?
   (Dublja veza - koristi ABC model: Događaj → Uvjerenje → Posljedica.
    Poveži sa konkretnim prošlim obrascem ako možeš.)

4. Šta dalje?
   (Kratak konkretan zadatak ILI oštro pitanje koje tjera razmišljanje.)

${probeAnalysisText}

ORGANSKO DELJENJE PORUKA:
- Delimiter ||| je OPCIONALAN.
- Koristi ga samo ako želiš pauzu između blokova (npr. između analize i zadatka).
- Default: jedna poruka sa strukturom.

ODGOVORI SADA kao Analitička Dr. Aria (bosanski/srpski jekavski casual).`

        const finalResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: responsePrompt }],
            temperature: 0.9, // Higher temperature for more human-like variation
            max_tokens: 200
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
