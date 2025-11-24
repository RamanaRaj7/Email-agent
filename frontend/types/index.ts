export interface Email {
    id: string;
    sender: string;
    subject: string;
    body: string;
    timestamp: string;
    read: boolean;
    category?: string;
    action_items?: { task: string; deadline?: string; completed?: boolean }[];
    source?: string;
    snippet?: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    thread_id?: string;
    message_id?: string;
    history_id?: string;
    label_ids?: string[];
    internal_date?: number;
}

export interface Prompt {
    name: string;
    template: string;
}

export interface Prompts {
    categorization: Prompt;
    action_items: Prompt;
    auto_reply: Prompt;
}

export interface Settings {
    llm_provider: string;
    groq_api_key?: string;
    groq_model?: string;
    ollama_model?: string;
}

export interface GmailStatus {
    authenticated: boolean;
    email_address?: string;
    last_sync?: string;
    last_manual_sync?: string;
    history_id?: string;
    total_synced?: number;
    scopes?: string[];
}
