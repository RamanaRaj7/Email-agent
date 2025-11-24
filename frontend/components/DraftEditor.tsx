import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { PenTool, X, Check, Mail } from "lucide-react";

export function DraftEditor({ onClose }: { onClose: () => void }) {
    const { selectedEmailId, emails, fetchEmails, gmailStatus } = useStore();
    const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [instructions, setInstructions] = useState("");

    const email = emails.find((e) => e.id === selectedEmailId);

    // Check if we're editing an existing draft and pre-fill
    useEffect(() => {
        if (email && email.category?.toLowerCase() === "draft") {
            // Pre-fill with existing draft content
            setDraft({
                subject: email.subject,
                body: email.body
            });
        }
    }, [email]);

    const handleGenerate = async () => {
        if (!selectedEmailId) return;
        setIsLoading(true);
        try {
            const res = await api.draft(selectedEmailId, instructions);
            setDraft(res);
        } finally {
            setIsLoading(false);
        }
    };

    if (!email) return null;

    const isDraft = email.category?.toLowerCase() === "draft";
    const isGmailAuthenticated = gmailStatus?.authenticated;

    return (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <PenTool className="w-5 h-5" />
                        {isDraft ? "Edit Draft" : "Draft Reply"}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    {!draft && !isDraft ? (
                        <>
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <p className="text-sm text-blue-900 font-medium mb-2">Original Email:</p>
                                <p className="text-sm text-gray-700">
                                    <span className="font-semibold">From:</span> {email.sender}
                                </p>
                                <p className="text-sm text-gray-700">
                                    <span className="font-semibold">Subject:</span> {email.subject}
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Additional Instructions (Optional)
                                </label>
                                <textarea
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                    placeholder="e.g., 'Make it more formal' or 'Keep it brief'"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                                    rows={3}
                                />
                            </div>
                            <button
                                onClick={handleGenerate}
                                disabled={isLoading}
                                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                            >
                                {isLoading ? "Generating..." : "Generate Draft"}
                            </button>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                                <input
                                    type="text"
                                    value={draft?.subject || ""}
                                    onChange={(e) => setDraft(draft ? { ...draft, subject: e.target.value } : null)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Email subject"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Body</label>
                                <textarea
                                    value={draft?.body || ""}
                                    onChange={(e) => setDraft(draft ? { ...draft, body: e.target.value } : null)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm"
                                    rows={12}
                                    placeholder="Email body"
                                />
                            </div>
                            <div className="space-y-3">
                                <div className="flex gap-3">
                                    <button
                                        onClick={async () => {
                                            if (!draft) return;
                                            await api.saveDraft({
                                                subject: draft.subject,
                                                body: draft.body,
                                                sender: "Ramana@email.com",
                                                source: isGmailAuthenticated ? "gmail_draft" : "mock_draft"
                                            });
                                            // Refresh emails to show the newly saved draft
                                            await fetchEmails();
                                            onClose();
                                        }}
                                        className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
                                    >
                                        <Check className="w-5 h-5" />
                                        Save Draft
                                    </button>
                                    {!isDraft && (
                                        <button
                                            onClick={() => setDraft(null)}
                                            className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                                        >
                                            Start Over
                                        </button>
                                    )}
                                </div>
                                {!isDraft && isGmailAuthenticated && (
                                    <button
                                        onClick={async () => {
                                            if (!draft || !email) return;
                                            await api.sendGmail({
                                                to: [email.sender],
                                                subject: draft.subject,
                                                body: draft.body,
                                                thread_id: email.id,
                                                in_reply_to: email.id
                                            });
                                            await fetchEmails();
                                            onClose();
                                        }}
                                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                                    >
                                        <Mail className="w-5 h-5" />
                                        Reply with Gmail
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
