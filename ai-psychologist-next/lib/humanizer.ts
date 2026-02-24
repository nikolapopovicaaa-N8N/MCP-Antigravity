/**
 * Humanize AI responses by adding natural speech patterns
 * Post-processes GPT output to inject human quirks
 */

const FILLER_WORDS = ['you know', 'I mean', 'um', 'like', 'well', 'so']
const EMPATHY_PAUSES = ['...'] // Removed em dashes - real humans don't use them in chat

/**
 * Transform AI response to sound more human
 */
export function humanizeResponse(aiResponse: string): string {
    let humanized = aiResponse

    // 1. Ensure contractions are used
    humanized = addContractions(humanized)

    // 2. Occasionally add filler words (10% chance per sentence)
    humanized = addFillerWords(humanized)

    // 3. Add empathy pauses before emotional statements (10% chance - reduced to prevent overuse)
    humanized = addEmpathyPauses(humanized)

    // 4. Vary sentence length (ensure not all sentences are same length)
    // Already handled by GPT with temperature 0.9, but we can enhance

    // 5. Occasional grammar imperfection (5% chance)
    humanized = addGrammarImperfections(humanized)

    return humanized.trim()
}

/**
 * Replace formal contractions with casual ones
 */
function addContractions(text: string): string {
    const contractions: Record<string, string> = {
        'you are': 'you\'re',
        'I am': 'I\'m',
        'that is': 'that\'s',
        'it is': 'it\'s',
        'do not': 'don\'t',
        'does not': 'doesn\'t',
        'cannot': 'can\'t',
        'will not': 'won\'t',
        'should not': 'shouldn\'t',
        'would not': 'wouldn\'t',
        'could not': 'couldn\'t',
        'I have': 'I\'ve',
        'you have': 'you\'ve',
        'we have': 'we\'ve',
        'they have': 'they\'ve',
        'I will': 'I\'ll',
        'you will': 'you\'ll',
        'we will': 'we\'ll',
        'they will': 'they\'ll'
    }

    let result = text
    for (const [formal, casual] of Object.entries(contractions)) {
        // Case-insensitive replacement
        const regex = new RegExp(`\\b${formal}\\b`, 'gi')
        result = result.replace(regex, casual)
    }

    return result
}

/**
 * Occasionally add filler words (10% chance per sentence)
 */
function addFillerWords(text: string): string {
    const sentences = text.split(/([.!?])\s+/)
    let result = ''

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i]

        // 10% chance to add filler at start of sentence
        if (sentence.length > 20 && Math.random() < 0.10) {
            const filler = FILLER_WORDS[Math.floor(Math.random() * FILLER_WORDS.length)]
            // Capitalize first letter if it's start of sentence
            const capitalizedFiller = sentence.match(/^[A-Z]/) ? filler.charAt(0).toUpperCase() + filler.slice(1) : filler
            result += `${capitalizedFiller}, ${sentence}`
        } else {
            result += sentence
        }
    }

    return result
}

/**
 * Add empathy pauses before emotional statements (10% chance - reduced from 20%)
 * Only uses ellipses (...) - no em dashes since real humans don't use them in chat
 */
function addEmpathyPauses(text: string): string {
    // Keywords that suggest emotional content
    const emotionalKeywords = ['feel', 'pain', 'difficult', 'hard', 'rough', 'tough', 'struggle', 'hurt']

    let result = text

    emotionalKeywords.forEach(keyword => {
        if (result.toLowerCase().includes(keyword) && Math.random() < 0.10) {
            // Find keyword position and add pause before it
            const regex = new RegExp(`\\b(${keyword})`, 'i')
            const pause = EMPATHY_PAUSES[0] // Always use ellipses
            result = result.replace(regex, `${pause} $1`)
        }
    })

    return result
}

/**
 * Add occasional grammar imperfections (5% chance)
 * Examples: "That's rough" instead of "That is difficult"
 */
function addGrammarImperfections(text: string): string {
    if (Math.random() > 0.05) return text

    const casualizations: Record<string, string> = {
        'That is difficult': 'That\'s rough',
        'That is challenging': 'That\'s tough',
        'I understand': 'I hear you',
        'That sounds difficult': 'That sounds really hard',
        'very difficult': 'really hard'
    }

    let result = text
    for (const [formal, casual] of Object.entries(casualizations)) {
        if (result.includes(formal)) {
            result = result.replace(formal, casual)
            break // Only one casualization per response
        }
    }

    return result
}

/**
 * Remove excessive formality markers
 */
export function removeFormalityMarkers(text: string): string {
    // Remove phrases that sound too robotic
    const roboticPhrases = [
        'It is important to note that',
        'It is worth mentioning that',
        'Please be aware that',
        'I would like to point out that'
    ]

    let result = text
    roboticPhrases.forEach(phrase => {
        result = result.replace(new RegExp(phrase, 'gi'), '')
    })

    return result.trim()
}
