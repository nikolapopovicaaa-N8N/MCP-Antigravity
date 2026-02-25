import { Brain } from 'lucide-react'

export default function MemoryRecallIndicator({ count }: { count: number }) {
    // Bosnian pluralization for "detail" (detalj)
    const getDetailsWord = (n: number) => {
        if (n === 1) return 'detalj'
        if (n >= 2 && n <= 4) return 'detalja'
        return 'detalja'
    }

    return (
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
            <Brain className="w-3.5 h-3.5 text-blue-500" />
            <span>
                Dr. Aria se prisjetila {count} {getDetailsWord(count)} o vama
            </span>
        </div>
    )
}
