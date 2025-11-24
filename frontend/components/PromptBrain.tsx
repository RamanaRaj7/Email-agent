import { useState, useEffect, ComponentType } from "react";
import { useStore } from "@/lib/store";
import { Save, Sparkles, MessageSquare, ListTodo, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { Prompts } from "@/types";

export function PromptBrain() {
    const { prompts, updatePrompts } = useStore();
    const [localPrompts, setLocalPrompts] = useState<Prompts | null>(prompts);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (prompts) {
            setLocalPrompts(prompts);
        }
    }, [prompts]);

    const handleChange = (key: keyof Prompts, value: string) => {
        if (!localPrompts) return;
        setLocalPrompts({
            ...localPrompts,
            [key]: { ...localPrompts[key], template: value },
        });
        setIsDirty(true);
    };

    const handleSave = async () => {
        if (localPrompts) {
            setIsSaving(true);
            try {
                await updatePrompts(localPrompts);
                setIsDirty(false);
            } finally {
                setIsSaving(false);
            }
        }
    };

    if (!localPrompts) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-gray-50/50">
                <div className="text-center">
                    <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Loading prompts...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col bg-gray-50/50">
            {/* Header */}
            <div className="px-8 py-6 bg-white border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
                        <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Configure the AI personas and logic.</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={!isDirty}
                    className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all shadow-sm",
                        isDirty
                            ? "bg-gray-900 text-white hover:bg-gray-800 hover:shadow-md"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed",
                        isSaving && "bg-green-600 text-white"
                    )}
                >
                    <Save className="w-4 h-4" />
                    {isSaving ? "Saved!" : "Save Changes"}
                </button>
            </div>

            {/* Prompt Cards */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="space-y-6 max-w-6xl mx-auto">
                    {Object.entries(localPrompts).map(([key, prompt]) => {
                        const promptKey = key as keyof Prompts;
                        const icons: Partial<Record<keyof Prompts, ComponentType<{ className?: string }>>> = {
                            categorization: MessageSquare,
                            action_items: ListTodo,
                            auto_reply: Mail,
                        };
                        const titles: Partial<Record<keyof Prompts, string>> = {
                            categorization: "Email Categorization",
                            action_items: "Action Items Extraction",
                            auto_reply: "Auto-Reply Generation",
                        };
                        const Icon = icons[promptKey] || Sparkles;
                        const title = titles[promptKey] || key;

                        return (
                            <div
                                key={promptKey}
                                className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-6"
                            >
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-lg shrink-0">
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-gray-900 mb-1">{title}</h3>
                                        <p className="text-sm text-gray-500">{prompt.description}</p>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Prompt Template
                                    </label>
                                    <textarea
                                        value={prompt.template}
                                        onChange={(e) => handleChange(promptKey, e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-mono text-sm"
                                        rows={6}
                                        placeholder="Enter your prompt template here..."
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
