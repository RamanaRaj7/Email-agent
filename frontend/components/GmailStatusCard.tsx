import { GmailStatus } from "@/types";
import { cn } from "@/lib/utils";
import { MailCheck, PlugZap, RefreshCw, Send, ShieldCheck } from "lucide-react";

interface GmailStatusCardProps {
    status: GmailStatus | null;
    onConnect: () => void;
    onSync: (full?: boolean) => void;
    isSyncing: boolean;
    onCompose: () => void;
    onDisconnect: () => void;
    onClearIndexes: () => void;
}

export function GmailStatusCard({
    status,
    onConnect,
    onSync,
    isSyncing,
    onCompose,
    onDisconnect,
    onClearIndexes,
}: GmailStatusCardProps) {
    const authenticated = status?.authenticated;
    const lastSync = status?.last_sync
        ? new Date(status.last_sync).toLocaleString()
        : "Never";

    return (
        <div className="mx-6 mt-4 mb-2 bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-4 flex flex-wrap gap-6 items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={cn("p-3 rounded-xl", authenticated ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600")}>
                    {authenticated ? <MailCheck className="w-5 h-5" /> : <PlugZap className="w-5 h-5" />}
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Gmail</p>
                    <p className="text-lg font-bold text-gray-900">
                        {authenticated ? status?.email_address : "Not connected"}
                    </p>
                    <p className="text-xs text-gray-500">Last sync: {lastSync}</p>
                </div>
            </div>

            <div className="flex items-center gap-6 text-sm text-gray-600 flex-wrap">
            </div>

            <div className="flex items-center gap-3 flex-wrap">
                {!authenticated ? (
                    <button
                        onClick={onConnect}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-semibold shadow"
                    >
                        <ShieldCheck className="w-4 h-4" />
                        Connect Gmail
                    </button>
                ) : (
                    <>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => onSync(false)}
                                disabled={isSyncing}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 transition text-sm font-medium disabled:opacity-60"
                            >
                                <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                                {isSyncing ? "Syncing..." : "Manual Sync"}
                            </button>
                            <button
                                onClick={() => onSync(true)}
                                disabled={isSyncing}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 transition text-sm font-medium disabled:opacity-60"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Full Resync
                            </button>
                            <button
                                onClick={onCompose}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-semibold shadow"
                            >
                                <Send className="w-4 h-4" />
                                Compose
                            </button>
                            <button
                                onClick={onDisconnect}
                                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 text-sm font-semibold shadow-sm"
                            >
                                Disconnect
                            </button>
                            <button
                                onClick={onClearIndexes}
                                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-semibold shadow-sm"
                            >
                                Clear Index
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
