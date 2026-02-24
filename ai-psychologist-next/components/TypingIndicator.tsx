export default function TypingIndicator() {
    return (
        <div className="flex items-center space-x-3">
            <div className="flex space-x-1.5 p-4 bg-white rounded-2xl w-16 items-center justify-center shadow-sm border border-slate-100">
                <div className="w-2 h-2 rounded-full bg-blue-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-blue-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-blue-300 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm text-slate-400 italic animate-pulse">Dr. Aria is typing...</span>
        </div>
    )
}
