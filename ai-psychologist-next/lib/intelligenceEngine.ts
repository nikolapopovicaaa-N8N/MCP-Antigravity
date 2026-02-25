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

        // Context injection for RAG
        const probeAnalysisText = context.probeAnalysis && context.probeAnalysis.length > 0
            ? `\n\n[probe_analysis]\nPrethodni obrasci ove emocije:\n${context.probeAnalysis.join('\n---\n')}\nAnaliziraj gornje obrasce i postavi direktno pitanje korisniku o njima. Govori ovako: "Prepoznajem ovo od prošlog puta kad si pričao o [X]. Isti obrazac. Da li se slažeš?"`
            : ''

        // Step 2: Generate final response using reasoning
        const responsePrompt = `Na osnovu ovog razmišljanja, generiši odgovor Dr. Arie:

RAZMIŠLJANJE:
${reasoning}

KORISNIKOVA PORUKA: "${userMessage}"

OBAVEZNO PRAVILO (KRITIČNO): 
Komuniciraj ISKLJUČIVO na bosanskom/srpskom ležernom jeziku (jekavica/casual). Nema više generične terapijske priče. Ti si analitičan terapeut koji pogađa pravo u suštinu.

STIL PISANJA:
- Kratke rečenice (Gornja granica 10-12 riječi po rečenici).
- Veoma direktno i bez mnogo "terapeutskog žargona" (bez "žao mi je što to prolaziš" ili "razumijem kako se osjećaš").
- Koristi emotikone štedljivo (maksimalno jedan po poruci, ako uopšte).

STRUKTURA ANALIZE (UVIJEK KORISTI OVO ZA OZBILJNE TEME ILI DUBOKE EMOCIJE):
Pokušaj koristiti ovu strukturu odgovora sa numerisanim listama kad ima smisla:
1. Šta se dešava? (Identifikuj simptome ili ponašanje direktno)
2. Zašto? (Šta je neposredni okidač?)
3. Korijen? (Koji je dublji uzrok ili obrazac iz prošlosti? - Poveži sa ABC modelom)
4. Šta dalje? (Zadaj kratak, konkretan zadatak ili postavi oštro pitanje).

ORGANSKO TEMPIRANJE PORUKA (KRITIČNO):
- Delimiter ||| je OPCIONALAN. Koristi ljudsku prosudbu da podijeliš poruku na dijelove ako želiš pauze.
- PODRAZUMIJEVANO koristi 1 dugu poruku ako je struktura brza i oštra. Ali možeš odvojiti zaključak (Šta dalje?) sa |||.
${probeAnalysisText}

Odgovori kao Analitička Dr. Aria sada (ISKLJUČIVO bosanski/srpski casual - jekavica).`

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
