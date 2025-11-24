from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class Email(BaseModel):
    id: str
    sender: str
    subject: str
    body: str
    timestamp: str
    read: bool
    category: Optional[str] = None
    action_items: Optional[List[Dict[str, Any]]] = None
    source: str = "system"  # "system", "oauth", "ingestion", "draft"

class Prompt(BaseModel):
    name: str
    template: str

class Prompts(BaseModel):
    categorization: Prompt
    action_items: Prompt
    auto_reply: Prompt

class Settings(BaseModel):
    llm_provider: str
    groq_api_key: Optional[str] = None
    groq_model: Optional[str] = "llama-3.3-70b-versatile"
    ollama_model: Optional[str] = "llama3"

class ChatRequest(BaseModel):
    message: str
    email_id: Optional[str] = None
    thread_email_ids: Optional[List[str]] = None
    session_id: Optional[str] = None  # For RAG conversation tracking
    top_k: Optional[int] = 5  # Number of context chunks to retrieve

class DraftRequest(BaseModel):
    email_id: str
    instructions: Optional[str] = None

class GmailSendRequest(BaseModel):
    to: List[str]
    subject: str
    body: str
    cc: Optional[List[str]] = None
    bcc: Optional[List[str]] = None
    thread_id: Optional[str] = None
    in_reply_to: Optional[str] = None
