const EMOTION_KEYWORDS: Record<string, string[]> = {
    anxious: ['anxious', 'worried', 'nervous', 'panic', 'overwhelmed', 'scared', 'fear', 'stress'],
    sad: ['sad', 'depressed', 'hopeless', 'crying', 'alone', 'empty', 'miserable', 'grief'],
    angry: ['angry', 'frustrated', 'furious', 'hate', 'rage', 'irritated', 'annoyed'],
    calm: ['calm', 'okay', 'fine', 'better', 'peaceful', 'good', 'relaxed'],
    confused: ['confused', 'lost', 'unsure', 'dont know', 'unclear', 'uncertain']
}

export function analyzeEmotion(messages: { role: string, content: string }[]): { dominantEmotion: string, intensity: number } {
    // Take last 5 user messages
    const userMessages = messages.filter(m => m.role === 'user').slice(-5);

    if (userMessages.length === 0) {
        return { dominantEmotion: 'neutral', intensity: 0 };
    }

    const emotionScores: Record<string, number> = {
        anxious: 0, sad: 0, angry: 0, calm: 0, confused: 0, hopeful: 0, neutral: 0
    };

    let maxPossibleScore = 0;

    userMessages.forEach((msg, index) => {
        // Most recent message has weight 2x, others 1x
        const weight = index === userMessages.length - 1 ? 2 : 1;
        const content = msg.content.toLowerCase();

        // Increment max possible score to normalize intensity
        maxPossibleScore += weight * 3;

        for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
            let hits = 0;
            for (const keyword of keywords) {
                if (content.includes(keyword)) {
                    hits++;
                }
            }
            emotionScores[emotion] += hits * weight;
        }
    });

    let dominantEmotion = 'neutral';
    let highestScore = 0;

    for (const [emotion, score] of Object.entries(emotionScores)) {
        if (score > highestScore) {
            highestScore = score;
            dominantEmotion = emotion;
        }
    }

    // Calculate intensity (0.0 - 1.0)
    const intensity = maxPossibleScore > 0 ? Math.min(highestScore / maxPossibleScore, 1.0) : 0;

    // Boost intensity slightly if any emotion was detected to make sure it plays a role
    const finalIntensity = highestScore > 0 && intensity < 0.2 ? 0.3 : intensity;

    return { dominantEmotion, intensity: finalIntensity };
}
