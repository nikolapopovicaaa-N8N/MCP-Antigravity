-- Dr. Aria v2.0 Database Schema Migration
-- Run this in Supabase SQL Editor

-- 1. Add cookie_id to psych_users for persistent identity
ALTER TABLE psych_users ADD COLUMN IF NOT EXISTS cookie_id TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_psych_users_cookie_id ON psych_users(cookie_id);

-- 2. Add reasoning column to psych_messages for chain-of-thought storage
ALTER TABLE psych_messages ADD COLUMN IF NOT EXISTS reasoning TEXT;
ALTER TABLE psych_messages ADD COLUMN IF NOT EXISTS vulnerability_level TEXT;
ALTER TABLE psych_messages ADD COLUMN IF NOT EXISTS contradiction_detected BOOLEAN DEFAULT FALSE;

-- 3. user_memory - Long-term factual memory
CREATE TABLE IF NOT EXISTS user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES psych_users(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('fact', 'preference', 'relationship', 'pattern')),
  category TEXT CHECK (category IN ('work', 'family', 'health', 'identity', 'trauma', 'other')),
  content TEXT NOT NULL,
  confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
  first_mentioned_session_id UUID REFERENCES psych_sessions(id),
  last_reinforced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_confidence ON user_memory(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_user_memory_created ON user_memory(created_at DESC);

-- 4. session_insights - Per-session AI summaries
CREATE TABLE IF NOT EXISTS session_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES psych_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES psych_users(id) ON DELETE CASCADE,
  dominant_theme TEXT,
  emotional_arc TEXT,
  breakthroughs TEXT[],
  unresolved_topics TEXT[],
  recommended_followup TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_session_insights_user_id ON session_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_session_insights_session_id ON session_insights(session_id);

-- 5. emotion_timeline - Emotion tracking over time
CREATE TABLE IF NOT EXISTS emotion_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES psych_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES psych_users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES psych_messages(id) ON DELETE CASCADE,
  emotion TEXT NOT NULL,
  intensity FLOAT NOT NULL CHECK (intensity >= 0.0 AND intensity <= 1.0),
  timestamp TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emotion_timeline_user_id ON emotion_timeline(user_id);
CREATE INDEX IF NOT EXISTS idx_emotion_timeline_timestamp ON emotion_timeline(timestamp DESC);

-- 6. trust_score - Relationship depth tracker
CREATE TABLE IF NOT EXISTS trust_score (
  user_id UUID PRIMARY KEY REFERENCES psych_users(id) ON DELETE CASCADE,
  score INT DEFAULT 20 CHECK (score >= 0 AND score <= 100),
  last_updated TIMESTAMPTZ DEFAULT now(),
  factors JSONB DEFAULT '{}'::JSONB
);

-- Insert default trust score for existing users
INSERT INTO trust_score (user_id, score, factors)
SELECT id, 20, '{}'::JSONB FROM psych_users
ON CONFLICT (user_id) DO NOTHING;
