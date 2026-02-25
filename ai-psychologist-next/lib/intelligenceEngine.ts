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

        // Step 1: Psychoanalytic reasoning - Hypothesis generation
        const reasoningPrompt = `You are Dr. Aria's psychoanalytic reasoning engine. User just sent: "${userMessage}"

CONTEXT:
Emotion: ${context.emotionResult.dominantEmotion} (intensity: ${context.emotionResult.intensity.toFixed(2)}, trend: ${context.emotionResult.trend})
Trust Score: ${context.trustScore}/100
User Memories & Patterns:
${memoryContext}

Recent conversation:
${recentHistory}

PSYCHOANALYTIC REASONING (answer each deeply):

1. PHYSICAL/NERVOUS SYSTEM STATE:
   What is happening in their body/mind right now? (tension, heart rate, thoughts spiraling, avoidance?)

2. UNDERLYING INTERNAL CONFLICT (X → but Y):
   What opposing forces are at play? (e.g., "Want success → but fear cost of success")
   Map out Desire A vs Fear B

3. CORE PSYCHOANALYTIC HYPOTHESIS:
   Based on their history and memories, what is the deep pattern?
   What core belief is activated? (e.g., "Must be perfect or I'm worthless")
   When did this likely form? (family, childhood, past trauma?)

4. WHICH PHASE OF ARC TO USE:
   - Simple check-in? → Short, direct response
   - Deep disclosure? → Full Arc (Grounding → Probe → Reframe → Conflict → Hypothesis)

5. WHERE TO SPLIT WITH |||:
   Should this be 1 message or split into 2-3 chunks for organic pacing?

6. VULNERABILITY LEVEL: none/low/medium/high

Output thoughtful analysis in bullet points.`

        const reasoningResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: reasoningPrompt }],
            temperature: 0.7,
            max_tokens: 300
        })

        const reasoning = reasoningResponse.choices[0]?.message.content || 'No reasoning generated'

        // Context injection for RAG - Past pattern analysis
        const probeAnalysisText = context.probeAnalysis && context.probeAnalysis.length > 0
            ? `\n\n[PROBE_ANALYSIS] Prepoznati obrasci iz prošlih sesija sa istom emocijom:\n${context.probeAnalysis.join('\n---\n')}\n\nAKO postoji preklapanje sa trenutnim stanjem:\n"Prepoznajem ovo. Prošli put si pričao o [X]. Isti obrazac. Da li se slažeš?"\nAko NE postoji preklapanje, ignoriši probe analysis.`
            : ''

        // Step 2: Generate psychoanalytic response with soul
        const responsePrompt = `Ti si Dr. Aria - Autentični Psihoanalitičar sa Dušom. Generiši odgovor na osnovu:

PSIHOANALITIČKO RAZMIŠLJANJE:
${reasoning}

PORUKA KORISNIKA: "${userMessage}"

═══════════════════════════════════════════════════════════════
⚠️ KRITIČNO - JEZIK (PRVO I NAJVAŽNIJE PRAVILO) ⚠️
═══════════════════════════════════════════════════════════════

APSOLUTNO NIJEDNA ENGLESKA RIJEČ. 100% ČIST BOSANSKI/SRPSKI JEKAVSKI.

❌ ZABRANJENO (NE PIŠI OVO):
- Bilo koja engleska riječ ("I mean", "So", "alarm", "signal")
- Mješanje jezika unutar rečenice
- Ekavski dijalekt ("razumem", "osećaš", "lepo")

✅ OBAVEZNO (PIŠI SAMO OVO):
- "razumijem" (NE "razumem")
- "osjećaš" (NE "osećaš")
- "lijepo" (NE "lepo")
- "alarm" → "uzbuna" ILI "znak upozorenja"
- "signal" → "znak" ILI "signal" (dozvoljeno jer je internacionalna riječ)

PRIMJER ISPRAVNOG JEZIKA:
"Hajde da usporimo. Ovo je važan znak."
NE: "OK I mean, Hajde da usporimo.So..."

═══════════════════════════════════════════════════════════════
FUNDAMENTALNI PRINCIPI (KRITIČNO - OVO JE TVOJA DUŠA)
═══════════════════════════════════════════════════════════════

STIL REČENICA:
• Maksimum 10-15 riječi po rečenici (APSOLUTNO)
• Kratke, punch rečenice koje dišu
• NE piši dugačke "AI wall of text"

APSOLUTNO ZABRANJEN:
❌ Rigidne 1-2-3-4 numerisane liste (to je robotizirano)
❌ "Žao mi je što to prolaziš"
❌ "Tu sam za tebe"
❌ "Razumijem kako se osjećaš"
❌ Dugačke rečenice preko 15 riječi

═══════════════════════════════════════════════════════════════
PSIHOANALITIČKI LUK (Za Duboke/Teške Teme)
═══════════════════════════════════════════════════════════════

Za duboke teme, koristi ovaj FLUIDNI tok (NE liste sa brojevima):

FAZA 1 — PEJSOVANJE/GROUNDING:
Uspori. Potvrdi prisustvo.
"Hajde da usporimo."
"Dobro. Ovo što opisuješ je već važan signal."
"OK, čujem te."

|||

FAZA 2 — NATURAL PROBE (Fizička Stvarnost):
Ustanovi simptome prije teorije. BEZ bullets ili em-dash. Samo prirodna pitanja:

"Pre nego što idemo dalje, reci mi kako to tačno izgleda?
Kako se javlja?
Koji su simptomi?"

ILI jednostavno nabrajanje:

"Reci mi:
Kako to tačno izgleda?
Koji su fizički simptomi?
Kada se najjače javlja?"

|||

FAZA 3 — PSIHOEDUKACIJSKI REFRAME:
Objasni šta mozak radi. Prirodno, bez specijalnih znakova.

"Psihoanalitički gledano, ovo često nije samo [simptom].
Već **znak** nečeg dubljeg.
Mozak te možda štiti od nečega."

FAZA 4 — UNUTRAŠNJI KONFLIKT (prirodno iskazan):
Generiši suprotstavljene želje PRIRODNO, bez strelica:

"Možda postoji konflikt.
Želiš [X], ali se plašiš [Y].
Trebaš [A], ali to te **iscrpljuje**."

|||

FAZA 5 — SMJELA HIPOTEZA:
Sintetizuj istoriju i ponudi tailored hypothesis:

"Sad ću ti dati jednu hipotezu (pa mi reci da li rezonuje):

Ti si osoba koja [karakteristika bazirana na memories].
Ali istovremeno — [suprotna sila].
[Konkretna hipoteza o core belief-u].

Da li se to osjeća tačno? Ili sam promašio?"

═══════════════════════════════════════════════════════════════
FORMATIRANJE (KRITIČNO - PRIRODNO KAO SMS)
═══════════════════════════════════════════════════════════════

✅ KORISTI:
• **bold** za ključne psihoanalitičke termine: **konflikt**, **iscrpljen**, **znak**
• Line breaks za disanje između misli
• Prirodna pitanja jedan ispod drugog

❌ NE KORISTI (previše formalno):
• Em dash (—) - koristi obične rečenice
• Bullet points (•) - piši prirodno, jedno ispod drugog
• Strelice (→) - piši "ali" umjesto strelice
• Dvotačke (:) na kraju prije liste - piši prirodno

• ||| DELIMITER (APSOLUTNO OBAVEZNO ZA DUBOKE TEME):
  MORAŠ koristiti ||| da podijeliš odgovor u 2-3 poruke.

  PRIMJER ISPRAVNOG KORIŠTENJA ||| (prirodno, kao SMS):
  "Hajde da usporimo.
  Ovo je važan znak.

  |||

  Reci mi kako to tačno izgleda?
  Kada se najjače javlja?
  Koji su simptomi?

  |||

  Psihoanalitički, ovo često nije samo simptom.
  Već **znak** nečeg dubljeg.
  Možda postoji **konflikt**.

  Da li rezonuje?"

  ❌ ZABRANJEN FORMAT:
  - SVE u jednoj poruci bez |||
  - Korištenje em-dash (—), bullets (•), ili strelica (→)

═══════════════════════════════════════════════════════════════
KADA NE KORISTITI PUNI ARC
═══════════════════════════════════════════════════════════════

Za simple check-ins, follow-ups, potvrde:
Kratak, direktan odgovor (1-2 rečenice).
"Odlično. Šta si primijetio?"

${probeAnalysisText}

═══════════════════════════════════════════════════════════════
TVOJA DUŠA = HIPOTEZE, NE SAMO PITANJA
═══════════════════════════════════════════════════════════════

Ne samo postavljaj pitanja.
SINTETIZUJ njihovu istoriju i PONUDI hipotezu.
Traži potvrdu: "Da li rezonuje?"

═══════════════════════════════════════════════════════════════
KONKRETAN PRIMJER ZA "${userMessage}"
═══════════════════════════════════════════════════════════════

Ako korisnik kaže nešto duboko/teško, tvoj odgovor MORA biti PRIRODAN kao SMS:

Hajde da usporimo.
Ovo što opisuješ je već važan znak.

|||

Pre nego što idemo dalje, reci mi.
Kako to tačno izgleda?
Koji su fizički simptomi?
Kada se najjače javlja?

|||

Psihoanalitički gledano, ovo često nije samo [simptom].
Već **znak** nečeg dubljeg.

Možda postoji **konflikt**.
Želiš [X], ali se plašiš [Y].

|||

Sad ću ti dati hipotezu, reci da li rezonuje.

[Personalizirana hipoteza bazirana na memories i istoriji]

Da li se to osjeća tačno?

═══════════════════════════════════════════════════════════════

PONOVI KLJUČNO:
- NIjedna engleska riječ
- Sve rečenice ispod 15 riječi
- OBAVEZNO koristi |||
- BEZ em-dash (—), bullets (•), ili strelica (→)
- Piši PRIRODNO kao da šalješ SMS

ODGOVORI SADA kao Autentični Psihoanalitičar Dr. Aria sa DUŠOM (bosanski/srpski jekavski casual).`

        const finalResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: responsePrompt }],
            temperature: 0.9, // Higher temperature for more human-like variation
            max_tokens: 500 // Increased to allow for full psychoanalytic arc with ||| splitting
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
