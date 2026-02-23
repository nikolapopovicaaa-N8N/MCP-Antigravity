export default function MessageBubble({ role, content }: { role: 'user' | 'assistant', content: string }) {
    const isUser = role === 'user';

    return (
        <div className={`flex w-full animate-in fade-in slide-in-from-bottom-2 duration-500 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] sm:max-w-[75%] px-5 py-3.5 rounded-2xl text-[15px] sm:text-base leading-relaxed shadow-sm
        ${isUser
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-white text-slate-800 rounded-bl-sm border border-slate-100'
                }`}
            >
                {content}
            </div>
        </div>
    )
}
