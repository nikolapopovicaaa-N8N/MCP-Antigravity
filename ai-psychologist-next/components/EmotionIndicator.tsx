import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface EmotionIndicatorProps {
    emotion: string
    trend?: 'improving' | 'worsening' | 'stable' | 'unknown'
}

export default function EmotionIndicator({ emotion, trend }: EmotionIndicatorProps) {
    if (!emotion || emotion === 'neutral') return null;

    // Bosnian (Jekavica) emotion translations
    const emotionTranslations: Record<string, string> = {
        anxious: 'anksiozno',
        sad: 'tužno',
        angry: 'ljuto',
        calm: 'smireno',
        confused: 'zbunjeno',
        hopeful: 'puno nade',
        happy: 'sretno',
        frustrated: 'frustrirano',
        overwhelmed: 'preopterećeno',
        worried: 'zabrinuto',
        neutral: 'neutralno'
    }

    const colors: Record<string, string> = {
        anxious: 'bg-orange-100/80 text-orange-700 border-orange-200',
        sad: 'bg-indigo-100/80 text-indigo-700 border-indigo-200',
        angry: 'bg-rose-100/80 text-rose-700 border-rose-200',
        calm: 'bg-teal-100/80 text-teal-700 border-teal-200',
        confused: 'bg-purple-100/80 text-purple-700 border-purple-200',
        hopeful: 'bg-emerald-100/80 text-emerald-700 border-emerald-200',
    }

    const colorClass = colors[emotion] || 'bg-slate-100 text-slate-700 border-slate-200';
    const translatedEmotion = emotionTranslations[emotion] || emotion;

    const getTrendIcon = () => {
        if (trend === 'improving') return <TrendingUp className="w-3 h-3" />
        if (trend === 'worsening') return <TrendingDown className="w-3 h-3" />
        if (trend === 'stable') return <Minus className="w-3 h-3" />
        return null
    }

    return (
        <div className={`text-xs px-2.5 py-1 rounded-full border shadow-sm transition-all duration-500 ease-in-out flex items-center gap-1.5 ${colorClass}`}>
            <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
            <span className="capitalize font-medium tracking-wide">{translatedEmotion}</span>
            {getTrendIcon()}
        </div>
    )
}
