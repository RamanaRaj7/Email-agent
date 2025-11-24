import { useEffect, useState } from "react";
import { X, Send } from "lucide-react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";

export interface ComposerConfig {
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    body?: string;
    threadId?: string;
    inReplyTo?: string;
}

interface GmailComposerProps {
    config: ComposerConfig | null;
    onClose: () => void;
    fromAddress?: string;
}

const toInput = (value?: string[]) => (value && value.length ? value.join(", ") : "");

const parseRecipients = (value: string): string[] =>
    value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

export function GmailComposer({ config, onClose, fromAddress }: GmailComposerProps) {
    const { fetchEmails, fetchGmailStatus } = useStore();
    const [to, setTo] = useState("");
    const [cc, setCc] = useState("");
    const [bcc, setBcc] = useState("");
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (config) {
            setTo(toInput(config.to));
            setCc(toInput(config.cc));
            setBcc(toInput(config.bcc));
            setSubject(config.subject || "");
            setBody(config.body || "");
            setError(null);
        }
    }, [config]);

    if (!config) return null;

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
                thread_id: config.threadId,
                in_reply_to: config.inReplyTo,
            });
            await fetchEmails();
            await fetchGmailStatus();
            onClose();
        } catch (err) {
            console.error("Failed to send Gmail message", err);
            setError("Unable to send email. Please recheck recipients and try again.");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-[700px] max-h-[85vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Compose with Gmail</h3>
                        {fromAddress && <p className="text-xs text-gray-500">From: {fromAddress}</p>}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wide">To</label>
                        <input
                            type="text"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wide">Cc</label>
                        <input
                            type="text"
                            value={cc}
                            onChange={(e) => setCc(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wide">Bcc</label>
                        <input
                            type="text"
                            value={bcc}
                            onChange={(e) => setBcc(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wide">Subject</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wide">Body</label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={12}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm resize-none"
                        />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                    <button
                        onClick={handleSend}
                        disabled={isSending}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50"
                    >
                        <Send className={isSending ? "w-4 h-4 animate-spin" : "w-4 h-4"} />
                        {isSending ? "Sending..." : "Send"}
                    </button>
                </div>
            </div>
        </div>
    );
}
