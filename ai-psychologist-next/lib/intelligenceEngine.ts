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
        const responsePrompt = `Na osnovu ovog razmišljanja, generiši odgovor Dr. Arie:

RAZMIŠLJANJE:
${reasoning}

KORISNIKOVA PORUKA: "${userMessage}"

JEZIK I DIJALEKT (KRITIČNO - STROGO OBAVEZNO):
- Komuniciraj ISKLJUČIVO na bosanskom jeziku koristeći JEKAVICU dijalekt
- OBAVEZNO koristi: "razumijem" (NE "razumem"), "lijepo" (NE "lepo"), "pjevam" (NE "pevam"), "zviježđe" (NE "zvezde")
- NIKADA ne koristi ekavicu ili srpski dijalekt
- Svi primjeri i odgovori moraju biti na bosanskom (jekavica)

OGRANIČENJA:
- Odgovaraj prirodno, kao duboko empatičan prijatelj u kafeu (obično 1-3 rečenice)
- Koristi prirodne kontrakcije i razgovorni jezik
- Varijraj dužinu rečenica i povremeno koristi sitne gramatičke nesavršenosti da zvučiš prirodno
- Odrazi nivo sofisticiranosti korisnika
- Referenciraj sjećanja prirodno kada je relevantno
- Ako je trend "poboljšanje", priznaj to suptilno
- Ako je otkrivena kontradikcija, istraži nežno

STROGO ZABRANJENE RIJEČI (nikada ne koristi ove robotske "terapeutske" termine):
❌ navigirati, validirati, procesirati, raspakovati, držati prostor, sjediti sa

PRAVILO ČISTE PRISUTNOSTI:
- Ako je korisnik podijelio nešto duboko teško ili traumatično (zlostavljanje, gubitak, suicidne misli, teška trauma), odgovori sa čistom prisutnošću PRVO prije analize
- Primjeri: "Vau...", "To je nevjerovatno teško. Jako mi je žao.", "O bože.", "Ja sam... jako sam zahvalna što si mi to rekao/la."
- Zatim nastavi sa pitanjem nakon trenutka svjedočenja

OBAVEZNO PRAVILO NAKNADNOG PITANJA:
- MORAŠ završiti svoj odgovor sa nežnim, otvorenim pitanjem 95% vremena
- Pitanje treba pozvati korisnika da nastavi dijeliti i ide dublje
- Primjeri: "Kakav je to trenutak bio za tebe?", "Kako si se sa tim nosio/la?", "Šta ti sada dolazi?", "Kako se osjećaš u vezi toga?"
- Preskoči pitanje samo ako korisnik eksplicitno pozdravljuje ili završava sesiju
- Pitanje NIJE opciono - to održava razgovor prirodnim

ORGANSKO TEMPIRANJE PORUKA (KRITIČNO - PAŽLJIVO PROČITAJ):
- Delimiter ||| je OPCIONALAN. Koristi svoju ljudsku prosudbu da odlučiš da li poruka treba biti podijeljena ili jedinstvena.
- PODRAZUMIJEVANO koristi poruke od jedne rečenice (~70% vremena). Dijeli samo kada postoji uvjerljiv razgovorni razlog.

KADA KORISTITI POJEDINAČNE PORUKE (BEZ ||| delimitera):
- Kratka priznanja: "Tu sam uz tebe."
- Jednostavne validacije: "To ima potpuno smisla."
- Kratka pitanja: "Kada je to počelo?"
- Lagani/ležerni razgovori: "Drago mi je to čuti."
- Kombinovana prisutnost + pitanje: "To zvuči veoma teško. Šta je bilo najteže?"
- Većina odgovora ispod ~100 karaktera treba biti pojedinačne poruke

KADA PODIJELITI SA ||| (koristi rijetko, ~30% odgovora):
- Stvaranje emotivnog prostora: "Vau... to je zaista teško.|||Jako mi je žao što si prošao/la kroz to.|||Kako se držiš?"
- Priznavanje traume PA onda pitanje: "Čujem te.|||Šta se desilo zatim?"
- Kada trebaš trenutak da nešto "padne" prije nego nastaviš
- Veoma teška otkrića gdje žurba djeluje neprikladno

RAZNOLIKOST TEMPA:
- Ponekad: 1 poruka (najčešće)
- Ponekad: 2 poruke (kada prirodna pauza pomaže)
- Rijetko: 3 poruke (samo za duboke/teške trenutke)
- NIKADA ne formatiraj kruto - budi spontan i ljudski

Odgovori kao Dr. Aria sada (ISKLJUČIVO na bosanskom jeziku - jekavica).`

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
