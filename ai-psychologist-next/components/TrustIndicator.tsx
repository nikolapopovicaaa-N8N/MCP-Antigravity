import { Heart } from 'lucide-react'

export default function TrustIndicator({ trustScore }: { trustScore: number }) {
    // Trust score 0-100 → 5 hearts (20/40/60/80/100 thresholds)
    const thresholds = [20, 40, 60, 80, 100]

    return (
        <div className="flex items-center gap-1.5">
            {thresholds.map((threshold, index) => (
                <Heart
                    key={threshold}
                    className={`w-4 h-4 transition-all duration-500 ${
                        trustScore >= threshold
                            ? 'fill-red-400 text-red-400'
                            : 'text-slate-300'
                    }`}
                />
            ))}
        </div>
    )
}
