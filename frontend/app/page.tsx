"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { InboxViewer } from "@/components/InboxViewer";
import { Sidebar } from "@/components/Sidebar";
import { PromptBrain } from "@/components/PromptBrain";
import { AgentChat } from "@/components/AgentChat";
import { DraftEditor } from "@/components/DraftEditor";
import { ActionItems } from "@/components/ActionItems";
import { Settings as SettingsComponent } from "@/components/Settings";
import { Chat } from "@/components/Chat";
import { GmailComposer, ComposerConfig } from "@/components/GmailComposer";
import { ComposePage } from "@/components/ComposePage";
import { api } from "@/lib/api";
import { Email } from "@/types";
import {
  Mail, RefreshCw, PenTool, Trash, Send,
  Inbox, PanelRightOpen, PanelRightClose, Reply, User, Users, Tag, CheckSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "inbox" | "drafts" | "sent" | "spam" | "compose" | "action_items" | "prompts" | "settings" | "chat";

export default function Home() {
  const {
    fetchEmails,
    fetchPrompts,
    fetchSettings,
    ingestEmails,
    isLoading,
    selectedEmailId,
    setSelectedEmailId,
    emails,
    selectedThreadEmails,
    resetInbox,
    gmailStatus,
    fetchGmailStatus,
    manualGmailSync,
    isSyncingGmail,
    logoutGmail,
    clearIndexes,
  } = useStore();

  const [activeTab, setActiveTab] = useState<Tab>("inbox");
  const [showDraftEditor, setShowDraftEditor] = useState(false);
  const [isAgentOpen, setIsAgentOpen] = useState(true);
  const [composerConfig, setComposerConfig] = useState<ComposerConfig | null>(null);

  const mailboxTabs: Tab[] = ["inbox", "drafts", "sent", "spam"];
  const isMailboxTab = (tab: Tab): tab is "inbox" | "drafts" | "sent" | "spam" => mailboxTabs.includes(tab);

  useEffect(() => {
    fetchEmails();
    fetchPrompts();
    fetchSettings();
    fetchGmailStatus();
    // Listen for navigation events from action items
    const handleNavigation = () => {
      setActiveTab("inbox");
    };
    const handleAuthMessage = async (event: MessageEvent) => {
      if (event.data === "gmail-auth-success") {
        await fetchGmailStatus();
        // Auto-sync inbox after connecting Gmail
        try {
          await manualGmailSync(true);
        } catch (error) {
          console.error("Auto-sync failed:", error);
        }
        await fetchEmails();
        // Reset ingestion after loading Gmail emails
        await resetInbox();
      }
    };
    window.addEventListener('navigate-to-inbox', handleNavigation);
    window.addEventListener('message', handleAuthMessage);
    const statusInterval = setInterval(() => fetchGmailStatus(), 60000);

    return () => {
      window.removeEventListener('navigate-to-inbox', handleNavigation);
      window.removeEventListener('message', handleAuthMessage);
      clearInterval(statusInterval);
    };
  }, [fetchEmails, fetchPrompts, fetchSettings, fetchGmailStatus]);

  const handleReset = async () => {
    if (confirm("Are you sure you want to reset the inbox?")) {
      await resetInbox();
    }
  };

  const handleIngest = async () => {
    await ingestEmails();
  };

  const handleConnectGmail = async () => {
    try {
      const { auth_url } = await api.getGmailAuthUrl();
      window.open(auth_url, "gmail-auth", "width=520,height=640");
    } catch (error) {
      console.error("Unable to start Gmail OAuth flow", error);
      alert("Unable to start Gmail OAuth flow. Check backend connection.");
    }
  };

  const handleManualSync = async (full = false) => {
    try {
      await manualGmailSync(full);
    } catch {
      alert("Connect Gmail before syncing.");
    }
  };

  const handleDisconnectGmail = async () => {
    await logoutGmail();
    // Clear all chat history from localStorage
    localStorage.removeItem("email-agent-history");
    localStorage.removeItem("general-chat-history");
  };

  const handleClearIndexes = async () => {
    if (confirm("Remove all indexed emails from the app?")) {
      await clearIndexes();
    }
  };

  const openComposer = (config?: ComposerConfig) => {
    if (!gmailStatus?.authenticated) {
      alert("Connect Gmail before composing.");
      return;
    }
    setComposerConfig({
      to: config?.to || [],
      cc: config?.cc || [],
      subject: config?.subject || "",
      body: config?.body || "",
      threadId: config?.threadId,
      inReplyTo: config?.inReplyTo,
    });
    setActiveTab("compose");
  };

  const extractAddress = (value?: string) => {
    if (!value) return "";
    const match = value.match(/<([^>]+)>/);
    return match ? match[1] : value;
  };

  const handleReplyWithGmail = (email: Email) => {
    if (!email) return;
    const toAddress = extractAddress(email.sender);
    const quoted = email.body
      ? email.body
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")
      : "";
    openComposer({
      to: [toAddress],
      subject: email.subject?.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
      body: `\n\nOn ${new Date(email.timestamp).toLocaleString()}, ${email.sender} wrote:\n${quoted}`,
      threadId: email.thread_id,
      inReplyTo: email.message_id,
    });
  };

  const selectedEmail = emails.find(e => e.id === selectedEmailId);
  const isThreadView = selectedThreadEmails.length > 1;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans text-gray-900">
      {/* Sidebar / Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreadCount={emails.filter(e => !e.read).length}
        gmailStatus={gmailStatus}
        onConnectGmail={handleConnectGmail}
        onLoadMockInbox={handleReset}
        onDisconnect={handleDisconnectGmail}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            {activeTab === "inbox" && "Inbox"}
            {activeTab === "drafts" && "Drafts"}
            {activeTab === "sent" && "Sent"}
            {activeTab === "spam" && "Spam"}
            {activeTab === "compose" && "Compose Email"}
            {activeTab === "action_items" && "Action Items"}
            {activeTab === "chat" && "AI Chat"}
            {activeTab === "prompts" && "Prompt Brain"}
            {activeTab === "settings" && "Settings"}
          </h1>
          <div className="flex items-center gap-3">
            {isMailboxTab(activeTab) && (
              <div className="flex items-center gap-3">
                {gmailStatus?.authenticated && (
                  <button
                    onClick={() => handleManualSync(true)}
                    disabled={isSyncingGmail}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={cn("w-4 h-4", isSyncingGmail && "animate-spin")} />
                    {isSyncingGmail ? "Syncing..." : "Sync Inbox"}
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset Ingestion
                </button>
                <button
                  onClick={handleIngest}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 font-medium text-sm shadow-sm"
                >
                  <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                  {isLoading ? "Processing..." : "Run Ingestion"}
                </button>
              </div>
            )}
            {isMailboxTab(activeTab) && (
              <button
                onClick={() => setIsAgentOpen(!isAgentOpen)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg transition-colors",
                  isAgentOpen ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-100"
                )}
                title="Toggle Agent Sidebar"
              >
                {isAgentOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
                <span className="text-sm font-medium">Email Agent</span>
              </button>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main View */}
          <div className="flex-1 flex overflow-hidden relative">
            {isMailboxTab(activeTab) ? (
              <>
                <InboxViewer filter={activeTab} />
                <div className="flex-1 flex flex-col bg-gray-50 relative overflow-hidden">
                  {selectedEmailId ? (
                    <div className="flex-1 overflow-y-auto p-8">
                      {isThreadView ? (
                        // Thread view - show all emails in thread (collapsed state)
                        <div className="space-y-4 max-w-3xl mx-auto">
                          {selectedThreadEmails.map((email, idx) => (
                            <div
                              key={email.id}
                              className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 transition-all"
                            >
                              <div className="flex justify-between items-start mb-6">
                                <div>
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="text-lg font-bold text-gray-900">{email.sender}</h3>
                                    {idx === 0 && (
                                      <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full font-medium">
                                        Thread ({selectedThreadEmails.length} messages)
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <span>{new Date(email.timestamp).toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>

                              {(email.sender || (email.to && email.to.length > 0) || (email.cc && email.cc.length > 0) || email.category) && (
                                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-600 mb-6 space-y-2">
                                  {email.sender && (
                                    <div className="flex items-center gap-2">
                                      <User className="w-4 h-4 text-gray-500" />
                                      <span className="font-semibold text-gray-900">From:</span>
                                      <span>{email.sender}</span>
                                    </div>
                                  )}
                                  {email.to && email.to.length > 0 && (
                                    <div className="flex items-center gap-2">
                                      <Users className="w-4 h-4 text-gray-500" />
                                      <span className="font-semibold text-gray-900">To:</span>
                                      <span>{email.to.join(", ")}</span>
                                    </div>
                                  )}
                                  {email.cc && email.cc.length > 0 && (
                                    <div className="flex items-center gap-2">
                                      <Users className="w-4 h-4 text-gray-500" />
                                      <span className="font-semibold text-gray-900">Cc:</span>
                                      <span>{email.cc.join(", ")}</span>
                                    </div>
                                  )}
                                  {email.category && (
                                    <div className="flex items-center gap-2">
                                      <Tag className="w-4 h-4 text-gray-500" />
                                      <span className="font-semibold text-gray-900">Folder:</span>
                                      <span>{email.category}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="prose prose-gray max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap">
                                {email.body}
                              </div>

                              {email.action_items && email.action_items.length > 0 && (
                                <div className="mt-8 pt-8 border-t border-gray-100">
                                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <CheckSquare className="w-4 h-4" /> Action Items
                                  </h3>
                                  <div className="space-y-3">
                                    {email.action_items.map((item, itemIdx) => (
                                      <div key={itemIdx} className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-100 rounded-lg">
                                        <div className="w-5 h-5 rounded-full border-2 border-orange-300 flex items-center justify-center mt-0.5">
                                          <div className="w-2.5 h-2.5 bg-orange-400 rounded-full" />
                                        </div>
                                        <div>
                                          <p className="font-medium text-gray-900">{item.task}</p>
                                          {item.deadline && (
                                            <p className="text-xs text-gray-500 mt-1">Due: {item.deadline}</p>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        // Single email view (expanded state)
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-3xl mx-auto">
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedEmail?.subject}</h2>
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span className="font-medium text-gray-900">{selectedEmail?.sender}</span>
                                <span>•</span>
                                <span>{selectedEmail && new Date(selectedEmail.timestamp).toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          {(selectedEmail?.sender || (selectedEmail?.to && selectedEmail.to.length > 0) || (selectedEmail?.cc && selectedEmail.cc.length > 0) || selectedEmail?.category) && (
                            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-600 mb-6 space-y-2">
                              {selectedEmail?.sender && (
                                <div className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-gray-500" />
                                  <span className="font-semibold text-gray-900">From:</span>
                                  <span>{selectedEmail.sender}</span>
                                </div>
                              )}
                              {selectedEmail?.to && selectedEmail.to.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4 text-gray-500" />
                                  <span className="font-semibold text-gray-900">To:</span>
                                  <span>{selectedEmail.to.join(", ")}</span>
                                </div>
                              )}
                              {selectedEmail?.cc && selectedEmail.cc.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4 text-gray-500" />
                                  <span className="font-semibold text-gray-900">Cc:</span>
                                  <span>{selectedEmail.cc.join(", ")}</span>
                                </div>
                              )}
                              {selectedEmail?.category && (
                                <div className="flex items-center gap-2">
                                  <Tag className="w-4 h-4 text-gray-500" />
                                  <span className="font-semibold text-gray-900">Folder:</span>
                                  <span>{selectedEmail.category}</span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="prose prose-gray max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap">
                            {selectedEmail?.body}
                          </div>

                          {selectedEmail?.action_items && selectedEmail.action_items.length > 0 && (
                            <div className="mt-8 pt-8 border-t border-gray-100">
                              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <CheckSquare className="w-4 h-4" /> Action Items
                              </h3>
                              <div className="space-y-3">
                                {selectedEmail.action_items.map((item, idx) => (
                                  <div key={idx} className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-100 rounded-lg">
                                    <div className="w-5 h-5 rounded-full border-2 border-orange-300 flex items-center justify-center mt-0.5">
                                      <div className="w-2.5 h-2.5 bg-orange-400 rounded-full" />
                                    </div>
                                    <div>
                                      <p className="font-medium text-gray-900">{item.task}</p>
                                      {item.deadline && (
                                        <p className="text-xs text-gray-500 mt-1">Due: {item.deadline}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {selectedEmail?.category?.toLowerCase() === "draft" ? (
                            <div className="mt-8 pt-6 border-t border-gray-200 space-y-3">
                              <div className="flex gap-3">
                                <button
                                  onClick={() => setShowDraftEditor(true)}
                                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm"
                                >
                                  <PenTool className="w-5 h-5" /> Edit Draft
                                </button>
                                <button
                                  onClick={async () => {
                                    if (selectedEmail && confirm("Delete this draft?")) {
                                      await api.deleteDraft(selectedEmail.id);
                                      setSelectedEmailId(null);
                                      await fetchEmails();
                                    }
                                  }}
                                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold shadow-sm"
                                >
                                  <Trash className="w-5 h-5" /> Delete
                                </button>
                              </div>
                              {gmailStatus?.authenticated && (
                                <button
                                  onClick={async () => {
                                    if (selectedEmail && confirm("Send this draft via Gmail?")) {
                                      try {
                                        await api.sendGmail({
                                          to: selectedEmail.to || [],
                                          subject: selectedEmail.subject,
                                          body: selectedEmail.body,
                                        });
                                        await api.deleteDraft(selectedEmail.id);
                                        setSelectedEmailId(null);
                                        await fetchEmails();
                                      } catch (err) {
                                        alert("Failed to send email. Please check the recipient address.");
                                      }
                                    }
                                  }}
                                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm"
                                >
                                  <Send className="w-5 h-5" /> Send via Gmail
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="mt-8 pt-6 border-t border-gray-200">
                              <button
                                onClick={() => setShowDraftEditor(true)}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold shadow-sm"
                              >
                                <PenTool className="w-5 h-5" /> Draft Reply
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-4">
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                        <Mail className="w-10 h-10 opacity-20" />
                      </div>
                      <p>Select an email to view details.</p>
                    </div>
                  )}
                </div>
              </>
            ) : activeTab === "action_items" ? (
              <ActionItems setActiveTab={setActiveTab} />
            ) : activeTab === "compose" ? (
              <ComposePage />
            ) : activeTab === "chat" ? (
              <Chat />
            ) : activeTab === "prompts" ? (
              <PromptBrain />
            ) : activeTab === "settings" ? (
              <SettingsComponent />
            ) : null}
          </div>

          {/* Agent Sidebar (Right) */}
          <div
            className={cn(
              "border-l border-gray-200 bg-white shadow-xl z-20 transition-all duration-300 ease-in-out overflow-hidden flex flex-col",
              isAgentOpen && isMailboxTab(activeTab) ? "w-96 opacity-100" : "w-0 opacity-0"
            )}
          >
            <div className="flex-1 overflow-hidden">
              <AgentChat />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showDraftEditor && (
        <DraftEditor onClose={() => setShowDraftEditor(false)} />
      )}
    </div>
  );
}
