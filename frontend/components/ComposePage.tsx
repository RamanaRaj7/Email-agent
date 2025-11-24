import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";

export function ComposePage() {
    const { fetchEmails, fetchGmailStatus, gmailStatus } = useStore();
    const [to, setTo] = useState("");
    const [cc, setCc] = useState("");
    const [bcc, setBcc] = useState("");
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [instructions, setInstructions] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const parseRecipients = (value: string): string[] =>
        value
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean);

    const handleGenerateBody = async () => {
        if (!subject && !instructions) {
            setError("Please provide either a subject or instructions to generate email body.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        try {
            const prompt = instructions || `Write a professional email body for the subject: "${subject}"`;
            const response = await api.chat(prompt);
            setBody(response.response);
            setInstructions("");
        } catch (err) {
            console.error("Failed to generate email body", err);
            setError("Unable to generate email body. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSend = async () => {
        const toList = parseRecipients(to);
        if (toList.length === 0) {
            setError("At least one recipient is required.");
            return;
        }
        setIsSending(true);
        setError(null);
        try {
            await api.sendGmail({
                to: toList,
                cc: parseRecipients(cc),
                bcc: parseRecipients(bcc),
                subject,
                body,
            });
            await fetchEmails();
            await fetchGmailStatus();
            // Clear form
            setTo("");
            setCc("");
            setBcc("");
            setSubject("");
            setBody("");
            setError(null);
        } catch (err) {
            console.error("Failed to send Gmail message", err);
            setError("Unable to send email. Please recheck recipients and try again.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex-1 bg-gray-50 overflow-y-auto">
            <div className="max-w-4xl mx-auto p-8">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="text-lg font-semibold text-gray-900">New Message</h3>
                        {gmailStatus?.email_address && (
                            <p className="text-xs text-gray-500 mt-1">From: {gmailStatus.email_address}</p>
                        )}
                    </div>

                    <div className="p-6 space-y-4">
                        <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">To</label>
                            <input
                                type="text"
                                value={to}
                                onChange={(e) => setTo(e.target.value)}
                                placeholder="recipient@example.com"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">Cc</label>
                            <input
                                type="text"
                                value={cc}
                                onChange={(e) => setCc(e.target.value)}
                                placeholder="Optional"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">Bcc</label>
                            <input
                                type="text"
                                value={bcc}
                                onChange={(e) => setBcc(e.target.value)}
                                placeholder="Optional"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">Subject</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Email subject"
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <label className="text-xs text-blue-700 uppercase tracking-wide font-medium mb-2 block">
                                AI Content Generator
                            </label>
                            <textarea
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value)}
                                rows={3}
                                placeholder="e.g., 'Write a follow-up email about the project deadline' or 'Request a meeting to discuss budget'"
                                className="w-full border border-blue-200 rounded-lg px-3 py-2 mb-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                            />
                            <button
                                onClick={handleGenerateBody}
                                disabled={isGenerating}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Sparkles className={isGenerating ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
                                {isGenerating ? "Generating..." : "Generate Email Body"}
                            </button>
                        </div>

                        <div>
                            <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">Body</label>
                            <textarea
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                rows={16}
                                placeholder="Type your message here or use AI generator above..."
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 mt-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-none"
                            />
                        </div>
                        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
                    </div>

                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                        <button
                            onClick={handleSend}
                            disabled={isSending}
                            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send className={isSending ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
                            {isSending ? "Sending..." : "Send"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
