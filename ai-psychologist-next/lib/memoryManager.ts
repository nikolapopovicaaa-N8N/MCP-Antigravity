import { supabase } from './supabase'
import { openai } from './openai'

export interface Memory {
    id: string
    user_id: string
    memory_type: 'fact' | 'preference' | 'relationship' | 'pattern' | 'vocabulary'
    category: 'work' | 'family' | 'health' | 'identity' | 'trauma' | 'other' | 'language'
    content: string
    confidence: number
    first_mentioned_session_id: string
    last_reinforced_at: string
    created_at: string
}

export interface Message {
    role: 'user' | 'assistant'
    content: string
}

/**
 * Extract memories from conversation using GPT-4o
 * Runs async in background, does not block response
 */
export async function extractMemories(
    userId: string,
    sessionId: string,
    conversation: Message[]
): Promise<void> {
    try {
        const conversationText = conversation
            .map(m => `${m.role.toUpperCase()}: ${m.content}`)
            .join('\n\n')

        const extractionPrompt = `You are a memory extraction system for a therapy chatbot. Analyze this conversation and extract factual memories AND linguistic patterns about the user.

CONVERSATION:
${conversationText}

Extract memories in these categories:
- fact: Concrete facts about the user ("Works as a software engineer", "Has 2 kids aged 5 and 8")
- preference: Likes/dislikes ("Prefers morning exercise", "Hates confrontation")
- relationship: Info about relationships ("Mother is critical", "Best friend lives abroad")
- pattern: Behavioral patterns ("Avoids conflict", "Overthinks decisions")
- vocabulary: User's unique idioms, emotional vocabulary, and specific phrasings they use repeatedly ("Uses 'freaking out' to describe anxiety", "Calls difficult situations 'a mess'", "Says 'I'm drowning' when overwhelmed", "Uses phrase 'I can't even' when stressed")

IMPORTANT FOR VOCABULARY:
- Extract the EXACT words and phrases the user uses to describe their emotions and situations
- Look for repeated patterns in how they express themselves
- Note specific metaphors or colloquialisms they favor
- This helps the AI echo their language back to prove deep listening

Return ONLY memories that are explicitly stated or strongly implied. Do not infer too much.

Format as JSON array:
[
  {"memory_type": "fact", "category": "work", "content": "Works as a software engineer"},
  {"memory_type": "relationship", "category": "family", "content": "Mother is very critical"},
  {"memory_type": "vocabulary", "category": "language", "content": "Uses 'freaking out' to describe anxiety"}
]`

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: extractionPrompt }],
            response_format: { type: 'json_object' }
        })

        const content = response.choices[0]?.message.content
        if (!content) return

        const parsed = JSON.parse(content)
        const memories = Array.isArray(parsed) ? parsed : parsed.memories || []

        // Insert memories into database
        for (const memory of memories) {
            if (!memory.content || memory.content.length < 5) continue

            // Check if similar memory already exists
            const { data: existing } = await supabase
                .from('user_memory')
                .select('id, confidence')
                .eq('user_id', userId)
                .ilike('content', `%${memory.content.substring(0, 20)}%`)
                .single()

            if (existing) {
                // Memory exists — boost confidence
                await updateMemoryConfidence(existing.id, 0.1)
            } else {
                // New memory — insert
                await supabase.from('user_memory').insert({
                    user_id: userId,
                    memory_type: memory.memory_type || 'fact',
                    category: memory.category || 'other',
                    content: memory.content,
                    confidence: 1.0,
                    first_mentioned_session_id: sessionId
                })
            }
        }
    } catch (error) {
        console.error('Memory extraction error:', error)
        // Fail silently — don't break UX
    }
}

/**
 * Retrieve relevant memories for a given query
 * Uses simple keyword matching (can upgrade to vector search later)
 */
export async function getRelevantMemories(
    userId: string,
    query: string,
    limit: number = 10
): Promise<Memory[]> {
    try {
        // Extract keywords from query
        const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3)

        if (keywords.length === 0) {
            // No keywords — return most recent high-confidence memories
            const { data, error } = await supabase
                .from('user_memory')
                .select('*')
                .eq('user_id', userId)
                .gte('confidence', 0.5)
                .order('last_reinforced_at', { ascending: false })
                .limit(limit)

            return data || []
        }

        // Build keyword search query
        const { data, error } = await supabase
            .from('user_memory')
            .select('*')
            .eq('user_id', userId)
            .gte('confidence', 0.5)
            .or(keywords.map(kw => `content.ilike.%${kw}%`).join(','))
            .order('confidence', { ascending: false })
            .order('last_reinforced_at', { ascending: false })
            .limit(limit)

        return data || []
    } catch (error) {
        console.error('Memory retrieval error:', error)
        return []
    }
}

/**
 * Update memory confidence (boost when reinforced, decay when contradicted)
 */
export async function updateMemoryConfidence(memoryId: string, delta: number): Promise<void> {
    try {
        const { data: memory } = await supabase
            .from('user_memory')
            .select('confidence')
            .eq('id', memoryId)
            .single()

        if (!memory) return

        const newConfidence = Math.max(0.0, Math.min(1.0, memory.confidence + delta))

        await supabase
            .from('user_memory')
            .update({
                confidence: newConfidence,
                last_reinforced_at: new Date().toISOString()
            })
            .eq('id', memoryId)
    } catch (error) {
        console.error('Memory confidence update error:', error)
    }
}

/**
 * Delete memories with very low confidence (< 0.3)
 */
export async function pruneStaleMemories(userId: string): Promise<void> {
    try {
        await supabase
            .from('user_memory')
            .delete()
            .eq('user_id', userId)
            .lt('confidence', 0.3)
    } catch (error) {
        console.error('Memory pruning error:', error)
    }
}

/**
 * Get all memories for a user (for debugging)
 */
export async function getAllMemories(userId: string): Promise<Memory[]> {
    try {
        const { data, error } = await supabase
            .from('user_memory')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        return data || []
    } catch (error) {
        console.error('Get all memories error:', error)
        return []
    }
}
