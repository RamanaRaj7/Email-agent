/**
 * Example Frontend Integration for RAG-Enhanced Email Chat
 * 
 * This file shows how to integrate the RAG system into your React/Next.js frontend
 */

import { useState, useEffect } from 'react';

// ============================================================================
// Type Definitions
// ============================================================================

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatSession {
  sessionId: string | null;
  messages: ChatMessage[];
}

interface RagChatRequest {
  message: string;
  email_id?: string;
  thread_email_ids?: string[];
  session_id?: string;
  top_k?: number;
}

interface RagChatResponse {
  response: string;
  session_id: string;
}

// ============================================================================
// Custom Hook: useRagChat
// ============================================================================

export function useRagChat(emailId?: string) {
  const [session, setSession] = useState<ChatSession>({
    sessionId: null,
    messages: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Send a message to the RAG-enhanced chat endpoint
   */
  const sendMessage = async (message: string, options?: {
    threadEmailIds?: string[];
    topK?: number;
  }) => {
    setIsLoading(true);
    setError(null);

    // Add user message to UI immediately
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };
    
    setSession(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage]
    }));

    try {
      const requestBody: RagChatRequest = {
        message,
        email_id: emailId,
        session_id: session.sessionId || undefined,
        top_k: options?.topK || 5,
        ...(options?.threadEmailIds && { thread_email_ids: options.threadEmailIds })
      };

      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: RagChatResponse = await response.json();

      // Add assistant response to UI
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString()
      };

      setSession(prev => ({
        sessionId: data.session_id,
        messages: [...prev.messages, assistantMessage]
      }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Clear the current chat session
   */
  const clearSession = async () => {
    if (!session.sessionId) return;

    try {
      await fetch(`http://localhost:8000/chat/session/${session.sessionId}`, {
        method: 'DELETE'
      });

      setSession({
        sessionId: null,
        messages: []
      });
    } catch (err) {
      console.error('Error clearing session:', err);
    }
  };

  /**
   * Load conversation history for the current session
   */
  const loadHistory = async (limit: number = 10) => {
    if (!session.sessionId) return [];

    try {
      const response = await fetch(
        `http://localhost:8000/chat/session/${session.sessionId}/history?limit=${limit}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load history');
      }

      const data = await response.json();
      return data.history;
    } catch (err) {
      console.error('Error loading history:', err);
      return [];
    }
  };

  return {
    session,
    messages: session.messages,
    isLoading,
    error,
    sendMessage,
    clearSession,
    loadHistory
  };
}

// ============================================================================
// Example Component: RagChatWidget
// ============================================================================

interface RagChatWidgetProps {
  emailId?: string;
  emailSubject?: string;
}

export function RagChatWidget({ emailId, emailSubject }: RagChatWidgetProps) {
  const { messages, isLoading, error, sendMessage, clearSession } = useRagChat(emailId);
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    await sendMessage(inputValue);
    setInputValue('');
  };

  const handleClearSession = async () => {
    if (confirm('Clear conversation history?')) {
      await clearSession();
    }
  };

  return (
    <div className="rag-chat-widget">
      {/* Header */}
      <div className="chat-header">
        <h3>Email Assistant {emailSubject && `- ${emailSubject}`}</h3>
        <button onClick={handleClearSession} className="btn-clear">
          Clear History
        </button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty-state">
            <p>Ask me anything about this email or your inbox!</p>
            <p className="text-sm text-gray-500">
              I'll remember our conversation and can recall previous discussions.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`message message-${msg.role}`}>
            <div className="message-content">{msg.content}</div>
            <div className="message-time">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message message-assistant">
            <div className="message-content">Thinking...</div>
          </div>
        )}

        {error && (
          <div className="message message-error">
            <div className="message-content">Error: {error}</div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="chat-input">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask about this email..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !inputValue.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

// ============================================================================
// Example Component: ChatHistoryViewer
// ============================================================================

export function ChatHistoryViewer({ sessionId }: { sessionId: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `http://localhost:8000/chat/session/${sessionId}/history?limit=20`
        );
        const data = await response.json();
        setHistory(data.history || []);
      } catch (err) {
        console.error('Error loading history:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (sessionId) {
      loadHistory();
    }
  }, [sessionId]);

  if (isLoading) {
    return <div>Loading history...</div>;
  }

  return (
    <div className="chat-history">
      <h4>Conversation History</h4>
      {history.map((item, idx) => (
        <div key={item.id} className="history-item">
          <div className="history-timestamp">
            {new Date(item.metadata.timestamp).toLocaleString()}
          </div>
          <div className="history-preview">
            <strong>User:</strong> {item.metadata.user_message?.substring(0, 100)}...
          </div>
          {item.metadata.email_subject && (
            <div className="history-email-context">
              📧 {item.metadata.email_subject}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Example: Advanced Usage with Context Control
// ============================================================================

export function AdvancedRagChatExample() {
  const { sendMessage, messages, session } = useRagChat();
  const [topK, setTopK] = useState(5);

  const handleSendWithCustomTopK = async (message: string) => {
    await sendMessage(message, { topK });
  };

  return (
    <div>
      {/* Top-K Control */}
      <div className="controls">
        <label>
          Context Depth (top-k):
          <input
            type="range"
            min="1"
            max="10"
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
          />
          <span>{topK}</span>
        </label>
      </div>

      {/* Session Info */}
      <div className="session-info">
        <p>Session ID: {session.sessionId || 'Not started'}</p>
        <p>Messages: {messages.length}</p>
      </div>

      {/* Chat Interface */}
      <RagChatWidget />
    </div>
  );
}

// ============================================================================
// Example: Multi-Email Thread Chat
// ============================================================================

export function ThreadChatExample({ threadEmailIds }: { threadEmailIds: string[] }) {
  const { sendMessage } = useRagChat();

  const handleThreadQuestion = async (question: string) => {
    await sendMessage(question, { threadEmailIds });
  };

  return (
    <div>
      <h4>Chat about Email Thread ({threadEmailIds.length} emails)</h4>
      <button onClick={() => handleThreadQuestion('Summarize this thread')}>
        Summarize Thread
      </button>
      <button onClick={() => handleThreadQuestion('What are the action items?')}>
        Extract Action Items
      </button>
      <button onClick={() => handleThreadQuestion('Who needs to respond?')}>
        Who Needs to Respond?
      </button>
    </div>
  );
}

// ============================================================================
// Example: Persistence with localStorage
// ============================================================================

export function usePersistentRagChat(emailId?: string) {
  const ragChat = useRagChat(emailId);
  const storageKey = `rag-chat-${emailId || 'global'}`;

  // Load session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const session = JSON.parse(stored);
      // Note: You'd need to add a method to restore session in useRagChat
      console.log('Restored session:', session);
    }
  }, [storageKey]);

  // Save session to localStorage on change
  useEffect(() => {
    if (ragChat.session.sessionId) {
      localStorage.setItem(storageKey, JSON.stringify({
        sessionId: ragChat.session.sessionId,
        timestamp: new Date().toISOString()
      }));
    }
  }, [ragChat.session.sessionId, storageKey]);

  return ragChat;
}

// ============================================================================
// CSS Styles (Tailwind or CSS-in-JS)
// ============================================================================

export const chatStyles = `
  .rag-chat-widget {
    display: flex;
    flex-direction: column;
    height: 500px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }

  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .message {
    display: flex;
    flex-direction: column;
    max-width: 80%;
  }

  .message-user {
    align-self: flex-end;
  }

  .message-user .message-content {
    background: #3b82f6;
    color: white;
  }

  .message-assistant {
    align-self: flex-start;
  }

  .message-assistant .message-content {
    background: #e5e7eb;
    color: #1f2937;
  }

  .message-content {
    padding: 0.75rem;
    border-radius: 8px;
    word-wrap: break-word;
  }

  .message-time {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  .chat-input {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    border-top: 1px solid #e5e7eb;
  }

  .chat-input input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 4px;
  }

  .chat-input button {
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .chat-input button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chat-empty-state {
    text-align: center;
    color: #6b7280;
    padding: 2rem;
  }
`;
