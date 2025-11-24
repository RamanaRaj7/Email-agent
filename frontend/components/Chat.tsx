import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { Send, Loader2, MessageSquare, RotateCcw } from "lucide-react";

interface Message {
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

export function Chat() {
    const [messages, setMessages] = useState<Message[]>(() => {
        // Load chat history from localStorage on mount
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("general-chat-history");
            if (saved) {
                const parsed = JSON.parse(saved);
                // Convert timestamp strings back to Date objects
                return parsed.map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                }));
            }
        }
        return [];
    });
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Persist chat history to localStorage whenever it changes
    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("general-chat-history", JSON.stringify(messages));
        }
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            role: "user",
            content: input,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const response = await api.chat(input);
            const assistantMessage: Message = {
                role: "assistant",
                content: response.response,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Chat error:", error);
            const errorMessage: Message = {
                role: "assistant",
                content: "Sorry, I encountered an error. Please try again.",
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleReset = () => {
        if (confirm("Are you sure you want to clear the chat history?")) {
            setMessages([]);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-gradient-to-b from-gray-50 to-white">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 bg-white/80 backdrop-blur-md">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-lg">
                            <MessageSquare className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Ask me anything about your emails or general questions</p>
                        </div>
                    </div>
                    {messages.length > 0 && (
                        <button
                            onClick={handleReset}
                            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Reset Chat"
                        >
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center max-w-md">
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mx-auto mb-4">
                                <MessageSquare className="w-10 h-10 text-blue-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">Start a Conversation</h3>
                            <p className="text-gray-500 mb-4">
                                I can help you with email-related tasks, answer questions, or just chat about anything!
                            </p>
                            <div className="grid grid-cols-1 gap-2 text-sm">
                                <button
                                    onClick={() => setInput("Summarize my recent emails")}
                                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-left transition-colors"
                                >
                                    Summarize my recent emails
                                </button>
                                <button
                                    onClick={() => setInput("What are my urgent action items?")}
                                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-left transition-colors"
                                >
                                    What are my urgent action items?
                                </button>
                                <button
                                    onClick={() => setInput("Help me draft a professional email")}
                                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg text-left transition-colors"
                                >
                                    Help me draft a professional email
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex items-start gap-4 ${message.role === "user" ? "flex-row-reverse" : ""
                                    }`}
                            >
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${message.role === "user"
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-200 text-gray-700"
                                        }`}
                                >
                                    {message.role === "user" ? "Y" : "AI"}
                                </div>
                                <div
                                    className={`flex-1 max-w-3xl ${message.role === "user" ? "flex justify-end" : ""
                                        }`}
                                >
                                    <div
                                        className={`rounded-2xl px-5 py-3 ${message.role === "user"
                                            ? "bg-blue-600 text-white"
                                            : "bg-white border border-gray-200 text-gray-900 shadow-sm"
                                            }`}
                                    >
                                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                                    </div>
                                    <div
                                        className={`text-xs text-gray-400 mt-1 px-1 ${message.role === "user" ? "text-right" : ""
                                            }`}
                                    >
                                        {message.timestamp.toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-gray-200 text-gray-700">
                                    AI
                                </div>
                                <div className="flex-1 max-w-3xl">
                                    <div className="rounded-2xl px-5 py-3 bg-white border border-gray-200 text-gray-900 shadow-sm">
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="text-gray-500">Thinking...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 bg-white">
                <div className="max-w-4xl mx-auto">
                    <div className="flex gap-3 items-end">
                        <div className="flex-1 relative">
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
                                className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none outline-none transition-all"
                                rows={1}
                                style={{
                                    minHeight: "48px",
                                    maxHeight: "120px",
                                }}
                            />
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg flex items-center gap-2 font-medium"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Send className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2 text-center">
                        AI responses may not always be accurate. Please verify important information.
                    </p>
                </div>
            </div>
        </div>
    );
}
