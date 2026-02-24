# Dr. Aria v2.0 — AI Psychologist (CLAUDE.md)

**Production-ready conversational AI therapist with brain-like memory, intelligence, and human voice.**

Reference this file at the start of every session.

---

## Version History

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-02-23 | Basic chatbot: 7-emotion analysis, 20-message memory, rigid 2-sentence responses |
| **v2.0** | 2026-02-23 | **Human-like AI: long-term memory, trend awareness, trust scoring, chain-of-thought, natural voice** |

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 App Router |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 |
| Database | Supabase JS SDK v2 |
| AI | OpenAI GPT-4o (2-step CoT) |
| Icons | lucide-react |
| Deployment | Vercel |

---

## File Structure v2.0

```
ai-psychologist-next/
├── app/
│   ├── api/chat/route.ts          # v2.0: 13-step brain pipeline
│   ├── page.tsx                   # Cookie persistence + v2.0 state
│   ├── layout.tsx, globals.css
├── components/
│   ├── ChatInput.tsx, ChatWindow.tsx, MessageBubble.tsx, TypingIndicator.tsx
│   ├── EmotionIndicator.tsx       # NEW: + trend arrow (↑/↓/─)
│   ├── TrustIndicator.tsx         # NEW: 5 hearts (trust score 0-100)
│   └── MemoryRecallIndicator.tsx  # NEW: "Dr. Aria recalled N details"
├── lib/
│   ├── emotionAnalyzerV2.ts       # NEW: Trend-aware (vs. 30-day baseline)
│   ├── intelligenceEngine.ts      # NEW: 2-step CoT (think → respond)
│   ├── memoryManager.ts           # NEW: Long-term memory CRUD
│   ├── trustCalculator.ts         # NEW: Trust scoring system
│   ├── humanizer.ts               # NEW: Voice transformation
│   ├── promptBuilderV2.ts         # NEW: Human-like adaptive prompt
│   ├── emotionAnalyzer.ts         # v1.0 (still used as base)
│   ├── openai.ts, supabase.ts
├── supabase/migrations/
│   └── 001_v2_schema.sql          # NEW: Migration for v2.0 tables
└── CLAUDE.md                      # This file
```

---

## Supabase Schema v2.0

### Existing Tables (Modified)
```sql
psych_users (
  id UUID PRIMARY KEY,
  cookie_id TEXT UNIQUE,    -- NEW: persistent user identity
  created_at TIMESTAMPTZ
)

psych_messages (
  id UUID,
  session_id UUID,
  role TEXT,
  content TEXT,
  detected_emotion TEXT,
  reasoning TEXT,                    -- NEW: chain-of-thought
  vulnerability_level TEXT,          -- NEW: 'none' | 'low' | 'medium' | 'high'
  contradiction_detected BOOLEAN,    -- NEW
  created_at TIMESTAMPTZ
)
```

### New Tables
```sql
user_memory (
  id UUID,
  user_id UUID,
  memory_type TEXT,        -- 'fact' | 'preference' | 'relationship' | 'pattern'
  category TEXT,           -- 'work' | 'family' | 'health' | 'identity' | 'trauma'
  content TEXT,            -- "Works as software engineer"
  confidence FLOAT,        -- 0.0-1.0 (decays if contradicted)
  first_mentioned_session_id UUID,
  last_reinforced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)

emotion_timeline (
  id UUID,
  user_id UUID,
  session_id UUID,
  message_id UUID,
  emotion TEXT,
  intensity FLOAT,
  timestamp TIMESTAMPTZ
)

trust_score (
  user_id UUID PRIMARY KEY,
  score INT,               -- 0-100 (starts at 20)
  last_updated TIMESTAMPTZ,
  factors JSONB            -- {"vulnerability_shown": 3, "session_completed": 5}
)

session_insights (         -- Future use
  id UUID,
  session_id UUID,
  user_id UUID,
  dominant_theme TEXT,
  emotional_arc TEXT,
  breakthroughs TEXT[],
  unresolved_topics TEXT[],
  recommended_followup TEXT,
  created_at TIMESTAMPTZ
)
```

---

## API Contract v2.0

### POST /api/chat

**Request:**
```json
{
  "sessionId": "uuid",
  "message": "user text",
  "userId": "uuid"    // NEW: required
}
```

**Response:**
```json
{
  "reply": "Human-like response",
  "emotion_detected": "anxious",
  "intensity": 0.75,
  "trend": "improving",              // NEW: improving|worsening|stable|unknown
  "trustScore": 45,                  // NEW: 0-100
  "memoriesRecalled": 3,             // NEW: count
  "reasoning": "CoT reasoning..."    // NEW: dev-only
}
```

---

## v2.0 Brain Pipeline (13 Steps in app/api/chat/route.ts)

1. Save user message → get `userMessageId`
2. Fetch last **50** messages (up from 20)
3. Get session count for this user
4. **Retrieve top 10 relevant long-term memories** (keyword search)
5. **Analyze emotion WITH trend** (compare vs. 30-day baseline)
6. **Get trust score** (0-100)
7. **Intelligence engine**: 2-step GPT call (reason → respond)
8. **Humanize response** (contractions, fillers, pauses)
9. Save assistant message with reasoning + metadata
10. **Extract new memories** (background async)
11. **Update trust score** if vulnerability detected
12. **Log emotion to timeline**
13. Return response to frontend

---

## Key Systems

### Memory System (`lib/memoryManager.ts`)
- GPT-4o extracts atomic facts after each exchange
- Stores in `user_memory` with confidence (1.0 → decays if contradicted)
- Retrieves top 10 relevant memories via keyword match
- Injected into prompt: "MEMORY CONTEXT: - Works as software engineer - Manager micromanages"

### Emotion Analysis V2 (`lib/emotionAnalyzerV2.ts`)
- Uses v1.0 keyword scoring as baseline
- Fetches last 30 days of `emotion_timeline`
- Calculates baseline: most common emotion + avg intensity
- Compares current vs. baseline → trend (improving/worsening/stable)
- Frontend shows arrow: ↑ (improving) / ↓ (worsening) / ─ (stable)

### Trust System (`lib/trustCalculator.ts`)
**Score ranges:**
- 0-20: Distrust
- 20-40: Stranger (initial)
- 40-60: Acquaintance
- 60-80: Trusted
- 80-100: Deep Alliance

**Events:**
- `vulnerability_shown`: +5
- `session_completed`: +2
- `contradiction_detected`: -3

**UI:** 5 hearts fill progressively (❤️❤️❤️🤍🤍 = 60/100)

**Prompt adaptation:**
- <30: "Keep it gentle, validate a lot"
- 60-80: "You can be more direct, challenge gently"
- 80+: "Name patterns directly, point out contradictions lovingly"

### Intelligence Engine (`lib/intelligenceEngine.ts`)
**2-step chain-of-thought:**
1. **Reasoning call:** "What is user REALLY feeling? Relevant memories? Contradictions? Vulnerability level? Tone?"
2. **Response call:** "Based on reasoning, generate Dr. Aria's response (1-3 sentences, natural voice)"

**Output:** `{ reasoning, response, vulnerabilityLevel, contradictionDetected }`

### Human Voice (`lib/humanizer.ts`)
**Post-processing transformations:**
1. **Contractions** (100%): "you are" → "you're"
2. **Filler words** (10%): "you know", "I mean", "um"
3. **Empathy pauses** (20%): "... difficult", "— pain"
4. **Grammar imperfections** (5%): "That's rough" vs "That is difficult"

### System Prompt V2 (`lib/promptBuilderV2.ts`)
**Key changes from v1.0:**
| v1.0 | v2.0 |
|---|---|
| "Max 2 sentences" | "Usually 1-3, but 4-5 if needed" |
| No memory | Injects top 10 memories |
| No trend awareness | "Emotional trend: IMPROVING. Acknowledge..." |
| Generic tone | Trust-based (stranger → deep ally) |
| No CoT | Explicit chain-of-thought instructions |
| Robotic | Human quirks (contractions, fillers, pauses) |

---

## Frontend State v2.0

| State | Type | Purpose |
|---|---|---|
| `userId` | `string \| null` | Persistent user ID from cookie |
| `sessionId` | `string \| null` | Current session UUID |
| `messages` | `Message[]` | Local chat history |
| `isLoading` | `boolean` | Loading state |
| `emotion` | `string` | Current dominant emotion |
| `trend` | `'improving' \| 'worsening' \| 'stable' \| 'unknown'` | NEW: Emotion trajectory |
| `trustScore` | `number` | NEW: 0-100 (displayed as filled hearts) |
| `memoriesRecalled` | `number` | NEW: Count shown in indicator |
| `error` | `string \| null` | Error message |
| `welcomeBack` | `boolean` | NEW: True if returning user |

**Cookie:** `aria_user_id` set on first visit (365-day expiry) → persistent user across sessions

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `OPENAI_API_KEY` | OpenAI API key (server-only) |

All in `.env.local` (excluded from git via `.env*`).

---

## Migration v1.0 → v2.0

**Breaking changes:**
- API route requires `userId` in request
- Frontend must pass `userId` from cookie
- Database migration required (`supabase/migrations/001_v2_schema.sql`)
- `EmotionIndicator` now requires `trend` prop

**Migration steps:**
1. Run SQL migration in Supabase
2. Clear browser cookies (force new `aria_user_id`)
3. Restart dev server
4. Test 3-session flow

---

## Testing (Manual)

**1. Run migration:** Copy `supabase/migrations/001_v2_schema.sql` → Supabase SQL Editor → Run

**2. Start dev server:** `npm run dev`

**3. Session 1 (First visit):**
- Send: "I'm feeling really anxious about work"
- Expected: Trust = 1 heart (20), no "Welcome back"
- Send: "I'm a software engineer, my manager micromanages"
- Expected: Trust → 2 hearts (40+), vulnerability detected

**4. Session 2 (Return next day):**
- Close browser, reopen
- Expected: "Welcome back" in header
- Send: "Hey, I'm back"
- Expected: Dr. Aria references work/manager from session 1

**5. Session 3 (Week later):**
- Send: "I had a breakthrough at work!"
- Expected: ↑ (improving trend), Dr. Aria acknowledges progress

**Validation:**
- [ ] Cookie persists across sessions
- [ ] "Welcome back" shows
- [ ] Memory recall indicator displays
- [ ] Trust hearts fill progressively
- [ ] Emotion indicator shows trend arrows
- [ ] Responses sound human (contractions, varied length)
- [ ] Check Supabase tables populated

---

## Known Behaviors

**v2.0 specific:**
- Memory extraction runs async (doesn't block response)
- Trust updates are fire-and-forget (errors logged, UX doesn't break)
- Emotion timeline logged async
- Cookie works across browser restarts, NOT incognito
- `session_insights` table created but NOT yet populated (future)
- Humanizer transformations are probabilistic (10% fillers, 20% pauses, 5% grammar)
- **2 GPT-4o calls per message** (reasoning → response) = ~2x cost vs. v1.0

**Performance:**
- v1.0: 1 GPT call (~1-2 sec latency)
- v2.0: 2 GPT calls + memory + trust (~3-5 sec latency)

---

## Future Enhancements (Not Implemented)

- Vector search for memories (OpenAI embeddings + pgvector)
- Session insights generation (GPT summarizes after 10+ exchanges)
- Streaming responses (reduce perceived latency)
- n8n integrations (email summaries, crisis alerts)
- Multi-language support
- Voice input/output (Whisper/TTS)

---

## Version Comparison

| Feature | v1.0 | v2.0 |
|---|---|---|
| Memory scope | 20 messages/session | 50 messages + long-term DB |
| Emotion analysis | Keyword-only | Keyword + 30-day trend |
| Trust system | None | 0-100 score, 5-heart UI |
| Voice | Robotic 2-sentence | Human (contractions, fillers, pauses) |
| Intelligence | Direct GPT call | 2-step chain-of-thought |
| User persistence | Anonymous per session | Cookie-based cross-session |
| Response time | ~1-2 sec | ~3-5 sec |
| Cost per message | ~$0.01 | ~$0.02 |

---

**Last updated:** 2026-02-23 (v2.0 release)
