import { Email, Prompts, Settings, GmailStatus } from "@/types";

const API_BASE = "http://localhost:8000";

export const api = {
    getEmails: async (): Promise<Email[]> => {
        const res = await fetch(`${API_BASE}/emails`);
        return res.json();
    },

    ingestEmails: async (): Promise<{ message: string; emails: Email[] }> => {
        const res = await fetch(`${API_BASE}/ingest`, { method: "POST" });
        return res.json();
    },

    getPrompts: async (): Promise<Prompts> => {
        const res = await fetch(`${API_BASE}/prompts`);
        return res.json();
    },

    updatePrompts: async (prompts: Prompts): Promise<{ message: string }> => {
        const res = await fetch(`${API_BASE}/prompts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(prompts),
        });
        return res.json();
    },

    getSettings: async (): Promise<Settings> => {
        const res = await fetch(`${API_BASE}/settings`);
        return res.json();
    },

    updateSettings: async (settings: Settings): Promise<{ message: string }> => {
        const res = await fetch(`${API_BASE}/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settings),
        });
        return res.json();
    },

    chat: async (message: string, emailId?: string, threadEmailIds?: string[]): Promise<{ response: string }> => {
        const res = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, email_id: emailId, thread_email_ids: threadEmailIds }),
        });
        return res.json();
    },

    draft: async (emailId: string, instructions?: string): Promise<{ subject: string; body: string }> => {
        const res = await fetch(`${API_BASE}/draft`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email_id: emailId, instructions }),
        });
        return res.json();
    },

    saveDraft: async (draft: { subject: string; body: string; sender?: string; source?: string }): Promise<{ message: string }> => {
        const res = await fetch(`${API_BASE}/drafts/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(draft),
        });
        return res.json();
    },

    deleteDraft: async (draftId: string): Promise<{ message: string }> => {
        const res = await fetch(`${API_BASE}/drafts/${draftId}`, {
            method: "DELETE",
        });
        return res.json();
    },

    resetInbox: async (): Promise<{ message: string }> => {
        const res = await fetch(`${API_BASE}/reset`, { method: "POST" });
        return res.json();
    },

    toggleActionItem: async (emailId: string, taskIndex: number): Promise<{ message: string }> => {
        const res = await fetch(`${API_BASE}/emails/${emailId}/tasks/${taskIndex}/toggle`, {
            method: "POST",
        });
        return res.json();
    },

    deleteActionItem: async (emailId: string, taskIndex: number): Promise<{ message: string }> => {
        const res = await fetch(`${API_BASE}/emails/${emailId}/tasks/${taskIndex}`, {
            method: "DELETE",
        });
        return res.json();
    },

    loadOAuthEmails: async (): Promise<{ message: string; emails: Email[] }> => {
        const res = await fetch(`${API_BASE}/oauth/load`, { method: "POST" });
        return res.json();
    },

    markAsRead: async (emailId: string): Promise<{ message: string }> => {
        const res = await fetch(`${API_BASE}/emails/${emailId}/read`, { method: "POST" });
        return res.json();
    },

    getGmailStatus: async (): Promise<GmailStatus> => {
        const res = await fetch(`${API_BASE}/gmail/status`);
        if (!res.ok) {
            throw new Error("Unable to fetch Gmail status");
        }
        return res.json();
    },

    getGmailAuthUrl: async (): Promise<{ auth_url: string }> => {
        const res = await fetch(`${API_BASE}/gmail/oauth/url`);
        if (!res.ok) {
            throw new Error("Unable to initiate Gmail auth");
        }
        return res.json();
    },

    syncGmail: async (full = false): Promise<{ synced: number; full_sync: boolean; last_sync: string }> => {
        const res = await fetch(`${API_BASE}/gmail/sync?full=${full ? "true" : "false"}`, {
            method: "POST",
        });
        if (!res.ok) {
            throw new Error("Sync failed");
        }
        return res.json();
    },

    logoutGmail: async (): Promise<GmailStatus> => {
        const res = await fetch(`${API_BASE}/gmail/logout`, {
            method: "POST",
        });
        if (!res.ok) {
            throw new Error("Unable to logout from Gmail");
        }
        return res.json();
    },

    clearIndexes: async (): Promise<{ message: string }> => {
        const res = await fetch(`${API_BASE}/emails/clear`, {
            method: "POST",
        });
        if (!res.ok) {
            throw new Error("Unable to clear email index");
        }
        return res.json();
    },

    sendGmail: async (payload: {
        to: string[];
        cc?: string[];
        bcc?: string[];
        subject: string;
        body: string;
        thread_id?: string | null;
        in_reply_to?: string | null;
    }): Promise<{ message_id: string; thread_id: string }> => {
        const res = await fetch(`${API_BASE}/gmail/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...payload,
                thread_id: payload.thread_id || undefined,
                in_reply_to: payload.in_reply_to || undefined,
            }),
        });
        if (!res.ok) {
            throw new Error("Unable to send email");
        }
        return res.json();
    },
};
