import { Brain } from 'lucide-react'

export default function MemoryRecallIndicator({ count }: { count: number }) {
    return (
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
            <Brain className="w-3.5 h-3.5 text-blue-500" />
            <span>
                Dr. Aria recalled {count} detail{count !== 1 ? 's' : ''} about you
            </span>
        </div>
    )
}
