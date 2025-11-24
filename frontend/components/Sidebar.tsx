import { ComponentType } from "react";
import {
    Inbox, FileEdit, AlertOctagon, CheckSquare, Brain, Settings,
    MessageSquare, Mail, LogOut, RefreshCw, PenTool, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GmailStatus } from "@/types";

type Tab = "inbox" | "drafts" | "sent" | "spam" | "compose" | "action_items" | "prompts" | "settings" | "chat";

type IconType = ComponentType<{ className?: string }>;

interface NavItemProps {
    tab: Tab;
    icon: IconType;
    label: string;
    count?: number;
    activeTab: Tab;
    onSelect: (tab: Tab) => void;
}

const NavItem = ({ tab, icon: Icon, label, count, activeTab, onSelect }: NavItemProps) => (
    <button
        onClick={() => onSelect(tab)}
        className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === tab
                ? "bg-blue-600 text-white"
                : "text-gray-700 hover:bg-gray-100"
        )}
    >
        <Icon className={cn("w-4 h-4", activeTab === tab ? "text-white" : "text-gray-500")} />
        <span className="flex-1 text-left">{label}</span>
        {count !== undefined && count > 0 && (
            <span className={cn(
                "text-xs px-2 py-0.5 rounded-full",
                activeTab === tab ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"
            )}>
                {count}
            </span>
        )}
    </button>
);

interface SidebarProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    unreadCount?: number;
    gmailStatus: GmailStatus | null;
    onConnectGmail: () => void;
    onLoadMockInbox: () => void;
    onDisconnect: () => void;
}

export function Sidebar({
    activeTab,
    setActiveTab,
    unreadCount = 0,
    gmailStatus,
    onConnectGmail,
    onLoadMockInbox,
    onDisconnect,
}: SidebarProps) {
    const authenticated = gmailStatus?.authenticated;

    return (
        <div className="w-64 bg-gray-50/50 border-r border-gray-200 flex flex-col h-full">
            {/* Gmail Connection Section */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3 px-3">
                    Email Source
                </div>
                <div className="space-y-2">
                    {!authenticated ? (
                        <>
                            <button
                                onClick={onConnectGmail}
                                className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                                <ShieldCheck className="w-4 h-4" />
                                Connect Gmail
                            </button>
                            <button
                                onClick={onLoadMockInbox}
                                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                            >
                                <Mail className="w-4 h-4" />
                                Mock Inbox
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="text-xs text-blue-600 font-medium mb-1">Connected</div>
                                <div className="text-xs text-blue-600 truncate">{gmailStatus?.email_address}</div>
                            </div>
                            <button
                                onClick={onDisconnect}
                                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                            >
                                <LogOut className="w-4 h-4" />
                                Disconnect
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="p-4">
                <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2 px-3">
                    Favorites
                </div>
                <div className="space-y-1">
                    <NavItem tab="inbox" icon={Inbox} label="Inbox" count={unreadCount} activeTab={activeTab} onSelect={setActiveTab} />
                    {authenticated && <NavItem tab="compose" icon={PenTool} label="Compose" activeTab={activeTab} onSelect={setActiveTab} />}
                    <NavItem tab="drafts" icon={FileEdit} label="Drafts" activeTab={activeTab} onSelect={setActiveTab} />
                    <NavItem tab="spam" icon={AlertOctagon} label="Spam" activeTab={activeTab} onSelect={setActiveTab} />
                </div>
            </div>

            <div className="p-4 pt-0">
                <div className="flex items-center gap-2 text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2 px-3">
                    Smart Views
                </div>
                <div className="space-y-1">
                    <NavItem tab="action_items" icon={CheckSquare} label="Action Items" activeTab={activeTab} onSelect={setActiveTab} />
                    <NavItem tab="chat" icon={MessageSquare} label="Email Chat" activeTab={activeTab} onSelect={setActiveTab} />
                    <NavItem tab="prompts" icon={Brain} label="Prompt Brain" activeTab={activeTab} onSelect={setActiveTab} />
                </div>
            </div>

            <div className="mt-auto p-4 border-t border-gray-200">
                <NavItem tab="settings" icon={Settings} label="Settings" activeTab={activeTab} onSelect={setActiveTab} />
            </div>
        </div>
    );
}
