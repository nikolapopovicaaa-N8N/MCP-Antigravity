export default function EmotionIndicator({ emotion }: { emotion: string }) {
    if (!emotion || emotion === 'neutral') return null;

    const colors: Record<string, string> = {
        anxious: 'bg-orange-100/80 text-orange-700 border-orange-200',
        sad: 'bg-indigo-100/80 text-indigo-700 border-indigo-200',
        angry: 'bg-rose-100/80 text-rose-700 border-rose-200',
        calm: 'bg-teal-100/80 text-teal-700 border-teal-200',
        confused: 'bg-purple-100/80 text-purple-700 border-purple-200',
        hopeful: 'bg-emerald-100/80 text-emerald-700 border-emerald-200',
    }

    const colorClass = colors[emotion] || 'bg-slate-100 text-slate-700 border-slate-200';

    return (
        <div className={`text-xs px-2.5 py-1 rounded-full border shadow-sm transition-all duration-500 ease-in-out flex items-center gap-1.5 ${colorClass}`}>
            <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
            <span className="capitalize font-medium tracking-wide">{emotion}</span>
        </div>
    )
}
