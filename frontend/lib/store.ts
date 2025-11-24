import { create } from "zustand";
import { Email, Prompts, Settings, GmailStatus } from "@/types";
import { api } from "./api";

const filterEmailsForDisplay = (emails: Email[], status: GmailStatus | null) => {
    if (status?.authenticated) {
        // When Gmail is connected, show only Gmail emails and Gmail-specific drafts
        return emails.filter((email) => 
            email.source?.toLowerCase() === "gmail" || 
            email.source?.toLowerCase() === "gmail_draft"
        );
    }
    // When Gmail is not connected, show only mock/system emails and mock-specific drafts
    return emails.filter((email) => 
        email.source?.toLowerCase() !== "gmail" && 
        email.source?.toLowerCase() !== "gmail_draft"
    );
};

interface AppState {
    emails: Email[];
    allEmails: Email[];
    prompts: Prompts | null;
    settings: Settings | null;
    selectedEmailId: string | null;
    selectedThreadEmails: Email[];
    isLoading: boolean;
    gmailStatus: GmailStatus | null;
    isSyncingGmail: boolean;

    fetchEmails: () => Promise<void>;
    ingestEmails: () => Promise<void>;
    fetchPrompts: () => Promise<void>;
    updatePrompts: (prompts: Prompts) => Promise<void>;
    fetchSettings: () => Promise<void>;
    updateSettings: (settings: Settings) => Promise<void>;
    setSelectedEmailId: (id: string | null) => void;
    setSelectedThreadEmails: (emails: Email[]) => void;
    resetInbox: () => Promise<void>;
    loadOAuthEmails: () => Promise<void>;
    toggleActionItem: (emailId: string, taskIndex: number) => void;
    deleteActionItem: (emailId: string, taskIndex: number) => void;
    fetchGmailStatus: () => Promise<void>;
    manualGmailSync: (full?: boolean) => Promise<void>;
    logoutGmail: () => Promise<void>;
    clearIndexes: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
    emails: [],
    allEmails: [],
    prompts: null,
    settings: null,
    selectedEmailId: null,
    selectedThreadEmails: [],
    isLoading: false,
    gmailStatus: null,
    isSyncingGmail: false,

    fetchEmails: async () => {
        set({ isLoading: true });
        try {
            const emails = await api.getEmails();
            const status = get().gmailStatus;
            set({
                allEmails: emails,
                emails: filterEmailsForDisplay(emails, status),
            });
        } finally {
            set({ isLoading: false });
        }
    },

    ingestEmails: async () => {
        set({ isLoading: true });
        let hasShownError = false;
        try {
            const status = get().gmailStatus;
            const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";
            
            const response = await fetch(`${API_BASE}/ingest`, {
                method: "POST",
            });

            if (!response.ok) {
                throw new Error("Failed to start ingestion");
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error("No response body");
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = JSON.parse(line.slice(6));
                        
                        if (data.type === "error" && data.message?.includes("Error calling Groq")) {
                            // Show error notification only once
                            if (!hasShownError) {
                                hasShownError = true;
                                alert(`Ingestion Error:\n\n${data.message}`);
                            }
                            // Stop processing and refresh to show partial results
                            const allEmails = await api.getEmails();
                            set({
                                allEmails,
                                emails: filterEmailsForDisplay(allEmails, status),
                            });
                            return;
                        } else if (data.type === "category") {
                            // Fast: Update category only
                            const updatedEmail = data.email;
                            set((state) => {
                                const allEmails = state.allEmails.map(email => 
                                    email.id === updatedEmail.id 
                                        ? { ...email, category: updatedEmail.category }
                                        : email
                                );
                                return {
                                    allEmails,
                                    emails: filterEmailsForDisplay(allEmails, status),
                                };
                            });
                        } else if (data.type === "action_items") {
                            // Slower: Update action items
                            const updatedEmail = data.email;
                            set((state) => {
                                const allEmails = state.allEmails.map(email => 
                                    email.id === updatedEmail.id 
                                        ? { ...email, action_items: updatedEmail.action_items }
                                        : email
                                );
                                return {
                                    allEmails,
                                    emails: filterEmailsForDisplay(allEmails, status),
                                };
                            });
                        } else if (data.type === "complete") {
                            // Final refresh to ensure consistency
                            const allEmails = await api.getEmails();
                            set({
                                allEmails,
                                emails: filterEmailsForDisplay(allEmails, status),
                            });
                        }
                    }
                }
            }
        } finally {
            set({ isLoading: false });
        }
    },

    resetInbox: async () => {
        set({ isLoading: true });
        try {
            await api.resetInbox();
            const emails = await api.getEmails();
            const status = get().gmailStatus;
            set({
                allEmails: emails,
                emails: filterEmailsForDisplay(emails, status),
                selectedEmailId: null,
            });
        } finally {
            set({ isLoading: false });
        }
    },

    loadOAuthEmails: async () => {
        set({ isLoading: true });
        try {
            const { emails } = await api.loadOAuthEmails();
            const status = get().gmailStatus;
            set({
                allEmails: emails,
                emails: filterEmailsForDisplay(emails, status),
            });
        } finally {
            set({ isLoading: false });
        }
    },

    fetchPrompts: async () => {
        const prompts = await api.getPrompts();
        set({ prompts });
    },

    updatePrompts: async (prompts) => {
        await api.updatePrompts(prompts);
        set({ prompts });
    },

    fetchSettings: async () => {
        const settings = await api.getSettings();
        set({ settings });
    },

    updateSettings: async (settings) => {
        await api.updateSettings(settings);
        set({ settings });
    },

    setSelectedEmailId: (id) => {
        set({ selectedEmailId: id });
        if (id) {
            set((state) => {
                const updateList = (list: Email[]) =>
                    list.map((email) => (email.id === id ? { ...email, read: true } : email));
                return {
                    emails: updateList(state.emails),
                    allEmails: updateList(state.allEmails),
                };
            });
            api.markAsRead(id).catch(console.error);
        }
    },

    setSelectedThreadEmails: (emails) => {
        set({ selectedThreadEmails: emails });
    },

    toggleActionItem: (emailId, taskIndex) => {
        const updateList = (list: Email[]) =>
            list.map((email) => {
                if (email.id === emailId && email.action_items) {
                    const updatedItems = email.action_items.map((item, idx) =>
                        idx === taskIndex ? { ...item, completed: !item.completed } : item
                    );
                    return { ...email, action_items: updatedItems };
                }
                return email;
            });
        set((state) => ({
            emails: updateList(state.emails),
            allEmails: updateList(state.allEmails),
        }));
        api.toggleActionItem(emailId, taskIndex).catch(console.error);
    },

    deleteActionItem: (emailId, taskIndex) => {
        const updateList = (list: Email[]) =>
            list.map((email) => {
                if (email.id === emailId && email.action_items) {
                    const updatedItems = email.action_items.filter((_, idx) => idx !== taskIndex);
                    return { ...email, action_items: updatedItems };
                }
                return email;
            });
        set((state) => ({
            emails: updateList(state.emails),
            allEmails: updateList(state.allEmails),
        }));
        api.deleteActionItem(emailId, taskIndex).catch(console.error);
    },

    fetchGmailStatus: async () => {
        const status = await api.getGmailStatus();
        set((state) => ({
            gmailStatus: status,
            emails: filterEmailsForDisplay(state.allEmails, status),
        }));
    },

    manualGmailSync: async (full = false) => {
        set({ isSyncingGmail: true });
        try {
            await api.syncGmail(full);
            const emails = await api.getEmails();
            const status = await api.getGmailStatus();
            set({
                allEmails: emails,
                emails: filterEmailsForDisplay(emails, status),
                gmailStatus: status,
            });
        } finally {
            set({ isSyncingGmail: false });
        }
    },

    logoutGmail: async () => {
        const status = await api.logoutGmail();
        const emails = await api.getEmails();
        set({
            gmailStatus: status,
            allEmails: emails,
            emails: filterEmailsForDisplay(emails, status),
            selectedEmailId: null,
        });
    },

    clearIndexes: async () => {
        await api.clearIndexes();
        set({
            emails: [],
            allEmails: [],
            selectedEmailId: null,
        });
    },
}));
