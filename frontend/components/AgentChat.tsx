import { useState, useRef, useEffect, useMemo } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Send, Bot, User, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "agent"; content: string };

export function AgentChat() {
    const { selectedEmailId, selectedThreadEmails } = useStore();
    const [history, setHistory] = useState<Record<string, Message[]>>(() => {
        // Load chat history from localStorage on mount
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("email-agent-history");
            return saved ? JSON.parse(saved) : {};
        }
        return {};
    });
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Persist chat history to localStorage whenever it changes
    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("email-agent-history", JSON.stringify(history));
        }
    }, [history]);

    // Create unique chat key: thread view uses sorted email IDs, individual uses single ID
    const chatKey = useMemo(() => {
        if (!selectedEmailId) return null;
        if (selectedThreadEmails.length > 1) {
            // Thread view: use sorted IDs to create unique key
            return `thread:${selectedThreadEmails.map(e => e.id).sort().join(',')}`;
        }
        // Individual email view
        return `email:${selectedEmailId}`;
    }, [selectedEmailId, selectedThreadEmails]);

    // Current messages based on selected email or thread
    const currentMessages = useMemo(() => {
        if (chatKey) {
            const greeting = selectedThreadEmails.length > 1
                ? `Hi! I'm your Email Agent. I have context of all ${selectedThreadEmails.length} emails in this thread. Ask me anything!`
                : "Hi! I'm your Email Agent. Ask me anything about this email.";
            return history[chatKey] || [{ role: "agent", content: greeting }];
        }
        return [{ role: "agent", content: "Select an email to start chatting." }];
    }, [history, chatKey, selectedThreadEmails]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [currentMessages, selectedEmailId]);

    const handleSend = async () => {
        if (!input.trim() || !selectedEmailId || !chatKey) return;

        const userMsg = input;
        setInput("");

        // Optimistic update
        const newHistory = { ...history };
        const greeting = selectedThreadEmails.length > 1
            ? `Hi! I'm your Email Agent. I have context of all ${selectedThreadEmails.length} emails in this thread. Ask me anything!`
            : "Hi! I'm your Email Agent. Ask me anything about this email.";
        if (!newHistory[chatKey]) {
            newHistory[chatKey] = [{ role: "agent", content: greeting }];
        }
        newHistory[chatKey] = [...newHistory[chatKey], { role: "user", content: userMsg }];
        setHistory(newHistory);

        setIsLoading(true);

        try {
            // Pass thread context if available
            const threadEmailIds = selectedThreadEmails.length > 1
                ? selectedThreadEmails.map(e => e.id)
                : undefined;
            const { response } = await api.chat(userMsg, selectedEmailId, threadEmailIds);

            setHistory(prev => ({
                ...prev,
                [chatKey]: [...(prev[chatKey] || []), { role: "agent", content: response }]
            }));
        } catch {
            setHistory(prev => ({
                ...prev,
                [chatKey]: [...(prev[chatKey] || []), { role: "agent", content: "Sorry, I encountered an error." }]
            }));
        } finally {
            setIsLoading(false);
        }
    };

    const handleReset = () => {
        if (!chatKey) return;
        const greeting = selectedThreadEmails.length > 1
            ? "Chat reset. How can I help you with this thread?"
            : "Chat reset. How can I help you with this email?";
        setHistory(prev => ({
            ...prev,
            [chatKey]: [{ role: "agent", content: greeting }]
        }));
    };

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200">
            <div className="p-4 border-b border-gray-200 font-bold text-lg flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-blue-600" /> Email Agent
                </div>
                {chatKey && (
                    <button
                        onClick={handleReset}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                        title="Reset Chat"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30" ref={scrollRef}>
                {currentMessages.map((msg, idx) => (
                    <div key={idx} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "")}>
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                            msg.role === "agent" ? "bg-white text-blue-600 border border-blue-100" : "bg-gray-900 text-white"
                        )}>
                            {msg.role === "agent" ? <Bot className="w-5 h-5" /> : <User className="w-4 h-4" />}
                        </div>
                        <div className={cn(
                            "p-3 rounded-2xl max-w-[85%] text-sm shadow-sm leading-relaxed",
                            msg.role === "agent"
                                ? "bg-white text-gray-800 rounded-tl-none border border-gray-100"
                                : "bg-blue-600 text-white rounded-tr-none"
                        )}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-white text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 shadow-sm">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div className="bg-white p-3 rounded-2xl rounded-tl-none text-sm text-gray-500 border border-gray-100 shadow-sm">
                            Thinking...
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex gap-2">
                    <input
                        type="text"
                        className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all"
                        placeholder={selectedEmailId ? "Ask about this email..." : "Select an email first..."}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        disabled={!selectedEmailId}
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim() || !selectedEmailId}
                        className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all shadow-sm hover:shadow-md"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
