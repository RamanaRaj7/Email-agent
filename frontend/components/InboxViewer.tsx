import { useState } from "react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Search, Mail, ChevronRight, ChevronDown } from "lucide-react";
import type { Email } from "@/types";

interface InboxViewerProps {
    filter: "inbox" | "drafts" | "sent" | "spam";
}

interface EmailThread {
    id: string;
    subject: string;
    emails: Email[];
    latestTimestamp: string;
    hasUnread: boolean;
}

export function InboxViewer({ filter }: InboxViewerProps) {
    const { emails, selectedEmailId, setSelectedEmailId, setSelectedThreadEmails } = useStore();
    const [subFilter, setSubFilter] = useState<string>("all");
    const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());

    // Extract unique categories from emails
    const categories = Array.from(new Set(
        emails
            .map(email => email.category)
            .filter((cat): cat is string => cat !== null && cat !== undefined && cat.trim() !== "")
    ));

    const filteredEmails = emails.filter((email) => {
        // Primary Filter (Folder)
        let matchesFolder = false;
        if (filter === "inbox") matchesFolder = !email.category?.toLowerCase().includes("spam") && !email.category?.toLowerCase().includes("draft") && !email.category?.toLowerCase().includes("sent");
        else if (filter === "spam") matchesFolder = email.category?.toLowerCase().includes("spam") || false;
        else if (filter === "drafts") matchesFolder = email.category?.toLowerCase().includes("draft") || false;
        else if (filter === "sent") matchesFolder = email.category?.toLowerCase().includes("sent") || false;
        else matchesFolder = true;

        if (!matchesFolder) return false;

        // Sub Filter (Tags/Status)
        if (subFilter === "unread") return !email.read;
        if (subFilter !== "all") {
            // Category filter
            return email.category === subFilter;
        }

        return true;
    });

    // Group emails into threads by normalized subject
    const normalizeSubject = (subject: string): string => {
        return subject
            .replace(/^(re|fwd|fw):\s*/gi, '')
            .trim()
            .toLowerCase();
    };

    const threads: EmailThread[] = [];
    const threadMap = new Map<string, EmailThread>();

    filteredEmails.forEach((email) => {
        const normalizedSubject = normalizeSubject(email.subject || '');

        if (!threadMap.has(normalizedSubject)) {
            const thread: EmailThread = {
                id: normalizedSubject,
                subject: email.subject,
                emails: [email],
                latestTimestamp: email.timestamp,
                hasUnread: !email.read,
            };
            threadMap.set(normalizedSubject, thread);
            threads.push(thread);
        } else {
            const thread = threadMap.get(normalizedSubject)!;
            thread.emails.push(email);
            if (new Date(email.timestamp) > new Date(thread.latestTimestamp)) {
                thread.latestTimestamp = email.timestamp;
            }
            if (!email.read) {
                thread.hasUnread = true;
            }
        }
    });

    // Sort threads by latest timestamp
    threads.forEach(thread => {
        thread.emails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });
    threads.sort((a, b) => new Date(b.latestTimestamp).getTime() - new Date(a.latestTimestamp).getTime());

    const toggleThread = (threadId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedThreads(prev => {
            const newSet = new Set(prev);
            if (newSet.has(threadId)) {
                newSet.delete(threadId);
            } else {
                newSet.add(threadId);
            }
            return newSet;
        });
    };

    const handleEmailClick = (email: Email, thread: EmailThread) => {
        setSelectedEmailId(email.id);

        // Toggle expansion when clicking on a thread
        if (thread.emails.length > 1) {
            const isCurrentlyExpanded = expandedThreads.has(thread.id);
            const isAlreadySelected = selectedEmailId === email.id;

            // If clicking the same email again, toggle expansion
            if (isAlreadySelected) {
                setExpandedThreads(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(thread.id)) {
                        newSet.delete(thread.id);
                    } else {
                        newSet.add(thread.id);
                    }
                    return newSet;
                });
            } else {
                // If clicking a different email, expand the thread
                setExpandedThreads(prev => new Set(prev).add(thread.id));
            }

            // Set context based on new expansion state
            const willBeExpanded = isAlreadySelected ? !isCurrentlyExpanded : true;
            if (willBeExpanded) {
                // Expanded: only selected email as context
                setSelectedThreadEmails([email]);
            } else {
                // Collapsed: all thread emails as context
                setSelectedThreadEmails(thread.emails);
            }
        } else {
            // Single email
            setSelectedThreadEmails([email]);
        }
    };

    return (
        <div className="flex flex-col h-full border-r border-gray-200 bg-white w-[400px] shrink-0">
            {/* Header / Search / Filter */}
            <div className="p-4 border-b border-gray-200 flex flex-col gap-3 bg-white/80 backdrop-blur-md z-10">
                {/* Search Bar (Mock) */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search"
                        className="w-full bg-gray-100 border-none rounded-lg pl-9 pr-4 py-1.5 text-sm focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                    />
                </div>

                {/* Filter Pills */}
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setSubFilter("all")}
                        className={cn(
                            "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                            subFilter === "all"
                                ? "bg-gray-900 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setSubFilter("unread")}
                        className={cn(
                            "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                            subFilter === "unread"
                                ? "bg-gray-900 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                    >
                        Unread
                    </button>
                    {categories.map((category) => (
                        <button
                            key={category}
                            onClick={() => setSubFilter(category)}
                            className={cn(
                                "px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize",
                                subFilter === category
                                    ? "bg-gray-900 text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {/* Email List */}
            <div className="flex-1 overflow-y-auto">
                {threads.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 flex flex-col items-center gap-2 mt-10">
                        <p>No emails found.</p>
                    </div>
                ) : (
                    threads.map((thread) => {
                        const isExpanded = expandedThreads.has(thread.id);
                        const displayEmails = thread.emails.length === 1 ? thread.emails : (isExpanded ? thread.emails : [thread.emails[0]]);
                        const threadCount = thread.emails.length;
                        const isThreadCollapsed = threadCount > 1 && !isExpanded;
                        const isThreadEmailSelected = thread.emails.some(e => e.id === selectedEmailId);

                        return (
                            <div key={thread.id}>
                                {displayEmails.map((email, idx) => {
                                    const isThreadHeader = idx === 0 && threadCount > 1;
                                    const isSelected = selectedEmailId === email.id;
                                    // Highlight if: selected OR (collapsed thread and any email in thread is selected)
                                    const shouldHighlight = isSelected || (isThreadCollapsed && isThreadEmailSelected);

                                    return (
                                        <div
                                            key={email.id}
                                            onClick={() => handleEmailClick(email, thread)}
                                            className={cn(
                                                "border-b border-gray-100 cursor-pointer transition-all duration-200 group relative",
                                                shouldHighlight ? "bg-blue-600 text-white" : "hover:bg-gray-50 text-gray-900",
                                                idx > 0 ? "pl-8" : ""
                                            )}
                                        >
                                            {/* Thread collapse/expand button */}
                                            {isThreadHeader && (
                                                <button
                                                    onClick={(e) => toggleThread(thread.id, e)}
                                                    className={cn(
                                                        "absolute left-2 top-4 p-1 rounded hover:bg-gray-200/50 transition-colors z-10",
                                                        shouldHighlight && "hover:bg-white/20"
                                                    )}
                                                >
                                                    {isExpanded ? (
                                                        <ChevronDown className={cn("w-4 h-4", shouldHighlight ? "text-white" : "text-gray-600")} />
                                                    ) : (
                                                        <ChevronRight className={cn("w-4 h-4", shouldHighlight ? "text-white" : "text-gray-600")} />
                                                    )}
                                                </button>
                                            )}

                                            <div className={cn("p-4", isThreadHeader ? "pl-10" : "pl-4")}>
                                                {/* Unread Indicator */}
                                                {!email.read && !shouldHighlight && (
                                                    <div className="absolute left-2 top-5 w-2.5 h-2.5 bg-blue-500 rounded-full" />
                                                )}

                                                <div className={cn(isThreadHeader ? "" : "pl-3")}>
                                                    <div className="flex justify-between items-baseline mb-0.5">
                                                        <div className="flex items-center gap-2 w-2/3">
                                                            <span className={cn(
                                                                "font-bold text-sm truncate",
                                                                shouldHighlight ? "text-white" : "text-gray-900"
                                                            )}>
                                                                {email.sender}
                                                            </span>
                                                            {isThreadHeader && !isExpanded && (
                                                                <span className={cn(
                                                                    "text-xs font-semibold px-1.5 py-0.5 rounded",
                                                                    shouldHighlight ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"
                                                                )}>
                                                                    {threadCount}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className={cn(
                                                            "text-xs",
                                                            shouldHighlight ? "text-blue-100" : "text-gray-400"
                                                        )}>
                                                            {new Date(email.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    </div>
                                                    <div className={cn(
                                                        "text-sm mb-1 truncate font-medium",
                                                        shouldHighlight ? "text-white" : "text-gray-800"
                                                    )}>
                                                        {email.subject}
                                                    </div>
                                                    <div className={cn(
                                                        "text-xs line-clamp-2",
                                                        shouldHighlight ? "text-blue-100" : "text-gray-500"
                                                    )}>
                                                        {email.snippet || email.body}
                                                    </div>
                                                    <div className="mt-2 flex gap-2 flex-wrap">
                                                        {email.category && (
                                                            <span className={cn(
                                                                "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                                                                shouldHighlight
                                                                    ? "bg-white/20 text-white"
                                                                    : "bg-blue-50 text-blue-700 border border-blue-200"
                                                            )}>
                                                                {email.category}
                                                            </span>
                                                        )}
                                                        {email.source?.toLowerCase().includes("gmail") && (
                                                            <span className={cn(
                                                                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                                                                shouldHighlight
                                                                    ? "bg-white/10 text-white"
                                                                    : "bg-red-50 text-red-600 border border-red-200"
                                                            )}>
                                                                <Mail className="w-3 h-3" />
                                                                Gmail
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
