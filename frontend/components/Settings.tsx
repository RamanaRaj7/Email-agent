import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { Settings as SettingsIcon, Save, Server, Key } from "lucide-react";
import { cn } from "@/lib/utils";

export function Settings() {
    const { settings, updateSettings } = useStore();
    const [localSettings, setLocalSettings] = useState(settings);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (settings) {
            // Keep editable settings in sync with store updates (e.g., after reloads)
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLocalSettings(settings);
        }
    }, [settings]);

    const handleSave = async () => {
        if (localSettings) {
            setIsSaving(true);
            await updateSettings(localSettings);
            setTimeout(() => setIsSaving(false), 1000);
        }
    };

    if (!localSettings) return <div>Loading settings...</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto w-full h-full overflow-y-auto">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-gray-200 text-gray-700 rounded-xl">
                        <SettingsIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
                        <p className="text-gray-500">Configure your AI brain.</p>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="font-semibold text-lg text-gray-900 flex items-center gap-2">
                            <Server className="w-5 h-5 text-blue-500" /> LLM Provider
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">Choose which AI model powers your agent.</p>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setLocalSettings({ ...localSettings, llm_provider: "ollama" })}
                                className={cn(
                                    "p-4 rounded-xl border-2 text-left transition-all",
                                    localSettings.llm_provider === "ollama"
                                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                )}
                            >
                                <div className="font-bold text-gray-900 mb-1">Ollama (Local)</div>
                                <div className="text-xs text-gray-500">Runs on your machine. Private & Free.</div>
                            </button>

                            <button
                                onClick={() => setLocalSettings({ ...localSettings, llm_provider: "groq" })}
                                className={cn(
                                    "p-4 rounded-xl border-2 text-left transition-all",
                                    localSettings.llm_provider === "groq"
                                        ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500"
                                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                                )}
                            >
                                <div className="font-bold text-gray-900 mb-1">Groq (Cloud)</div>
                                <div className="text-xs text-gray-500">Ultra-fast inference. Requires API Key.</div>
                            </button>
                        </div>

                        {localSettings.llm_provider === "groq" && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Key className="w-4 h-4" /> Groq API Key
                                    </label>
                                    <input
                                        type="password"
                                        value={localSettings.groq_api_key || ""}
                                        onChange={(e) => setLocalSettings({ ...localSettings, groq_api_key: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                                        placeholder="gsk_..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">Model Name</label>
                                    <input
                                        type="text"
                                        value={localSettings.groq_model || ""}
                                        onChange={(e) => setLocalSettings({ ...localSettings, groq_model: e.target.value })}
                                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                                        placeholder="e.g., llama-3.3-70b-versatile"
                                    />
                                </div>
                            </div>
                        )}

                        {localSettings.llm_provider === "ollama" && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">Model Name</label>
                                    <input
                                        type="text"
                                        value={localSettings.ollama_model || ""}
                                        onChange={(e) => setLocalSettings({ ...localSettings, ollama_model: e.target.value })}
                                        placeholder="e.g., llama3.2"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
                        <button
                            onClick={handleSave}
                            className={cn(
                                "flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white transition-all shadow-md hover:shadow-lg",
                                isSaving ? "bg-green-600" : "bg-gray-900 hover:bg-gray-800"
                            )}
                        >
                            {isSaving ? (
                                <>Saved!</>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" /> Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
