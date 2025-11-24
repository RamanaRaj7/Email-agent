import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel

from models import (
    ChatRequest,
    DraftRequest,
    GmailSendRequest,
    Prompts,
    Settings,
)
from services.gmail import GmailService
from services.inbox import inbox_service, DATA_DIR
from services.llm import llm_service
from services.rag import rag_service
import json
import asyncio
import uuid

os.makedirs(DATA_DIR, exist_ok=True)
TOKEN_FILE = os.path.join(DATA_DIR, "gmail_token.json")
CREDENTIALS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "credentials.json")

gmail_service = GmailService(
    credentials_file=CREDENTIALS_FILE,
    token_file=TOKEN_FILE,
)

app = FastAPI(title="Email Productivity Agent Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    settings = inbox_service.get_settings()
    llm_service.update_settings(settings.get("llm_provider"), settings.get("groq_api_key"))

@app.get("/")
def read_root():
    return {"message": "Email Productivity Agent Backend is running"}

@app.get("/emails")
def get_emails(limit: int = 20):
    """Get emails from inbox, limited to most recent by default"""
    all_emails = inbox_service.get_emails()
    # Sort by timestamp descending (most recent first)
    sorted_emails = sorted(
        all_emails,
        key=lambda x: x.get('timestamp', ''),
        reverse=True
    )
    # Return only the most recent emails based on limit
    return sorted_emails[:limit]

@app.get("/gmail/status")
def gmail_status():
    return gmail_service.get_status()

@app.get("/gmail/oauth/url")
def gmail_oauth_url():
    url = gmail_service.generate_auth_url()
    return {"auth_url": url}

@app.get("/gmail/oauth/callback")
def gmail_oauth_callback(code: str, state: str):
    gmail_service.finish_auth(state=state, code=code)
    # Clear mock inbox embeddings when logging in to Gmail
    # This ensures only Gmail emails are in the RAG system
    rag_service.clear_mock_inbox_embeddings()
    html = """
    <html>
        <head><title>Gmail Connected</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 2rem;">
            <h2>Gmail connected successfully!</h2>
            <p>You can close this window.</p>
            <script>
                if (window.opener) {
                    window.opener.postMessage('gmail-auth-success', '*');
                }
                setTimeout(() => window.close(), 1000);
            </script>
        </body>
    </html>
    """
    return HTMLResponse(content=html)

@app.post("/gmail/sync")
def gmail_sync(full: bool = False):
    return gmail_service.sync_messages(full_sync=full, triggered_by="manual")

@app.post("/gmail/logout")
def gmail_logout():
    gmail_service.logout()
    # Clear all Gmail email embeddings from RAG when disconnecting
    rag_service.clear_gmail_embeddings()
    return gmail_service.get_status()

@app.post("/gmail/send")
def gmail_send(request: GmailSendRequest):
    return gmail_service.send_message(
        to=request.to,
        cc=request.cc,
        bcc=request.bcc,
        subject=request.subject,
        body=request.body,
        thread_id=request.thread_id,
        in_reply_to=request.in_reply_to,
    )

@app.post("/ingest")
async def ingest_emails():
    """Stream email processing updates in real-time using SSE"""
    async def generate():
        # Get all emails first
        all_emails = inbox_service.get_emails()
        
        # Filter based on Gmail authentication status
        gmail_authenticated = gmail_service.is_authenticated()
        
        if gmail_authenticated:
            # Only ingest Gmail emails
            current_emails = [e for e in all_emails if e.get("source") == "gmail"]
            email_type = "Gmail"
        else:
            # Only ingest mock/system emails (exclude Gmail)
            current_emails = [e for e in all_emails if e.get("source") != "gmail"]
            email_type = "Mock/System"
        
        prompts = inbox_service.get_prompts()
        
        cat_prompt_template = prompts["categorization"]["template"]
        action_prompt_template = prompts["action_items"]["template"]
        
        total = len(current_emails)
        error_occurred = False
        
        # Send initial status indicating which emails are being ingested
        yield f"data: {json.dumps({'type': 'status', 'message': f'Ingesting {email_type} emails ({total} total)...'})}\n\n"
        
        # PHASE 1: Fast category tagging - stream immediately
        for idx, email in enumerate(current_emails):
            # Categorize every email via LLM
            prompt = f"{cat_prompt_template}\n\nEmail Body:\n{email['body']}\n\nIMPORTANT: Return ONLY the category name (e.g. 'Work', 'Personal', 'Newsletter', 'Finance'). Do not add any other text."
            category = llm_service.generate(prompt)
            
            # Check if LLM returned an error
            if category.startswith("Error calling Groq") or category.startswith("Error calling Ollama"):
                if not error_occurred:
                    error_occurred = True
                    yield f"data: {json.dumps({'type': 'error', 'message': category})}\n\n"
                    return
                
            email["category"] = category.strip()
            
            # Mark as ingested for mock/system emails only
            source = (email.get("source") or "").lower()
            if source not in ("draft", "gmail"):
                email["source"] = "ingestion"
            
            # Save category immediately
            inbox_service.upsert_email(email)
            
            # Stream the category update immediately (fast feedback)
            yield f"data: {json.dumps({'type': 'category', 'email': email, 'processed': idx + 1, 'total': total})}\n\n"
            await asyncio.sleep(0)
        
        # PHASE 2: Extract action items (slower, but category already visible)
        for idx, email in enumerate(current_emails):
            # Extract Actions only if not already present
            if not email.get("action_items") or email.get("action_items") is None or len(email.get("action_items", [])) == 0:
                prompt = f"{action_prompt_template}\n\nEmail Body:\n{email['body']}"
                response = llm_service.generate(prompt)
                
                # Check if LLM returned an error
                if response.startswith("Error calling Groq") or response.startswith("Error calling Ollama"):
                    if not error_occurred:
                        error_occurred = True
                        yield f"data: {json.dumps({'type': 'error', 'message': response})}\n\n"
                        return
                
                try:
                    start = response.find('{')
                    end = response.rfind('}') + 1
                    if start != -1 and end != -1:
                        json_str = response[start:end]
                        data = json.loads(json_str)
                        email["action_items"] = data.get("tasks", [])
                    else:
                        email["action_items"] = []
                except Exception as e:
                    print(f"Action items parsing error: {e}")
                    email["action_items"] = []
                
                # Save action items
                inbox_service.upsert_email(email)
                
                # Stream the action items update
                yield f"data: {json.dumps({'type': 'action_items', 'email': email, 'processed': idx + 1, 'total': total})}\n\n"
                await asyncio.sleep(0)
        
        # PHASE 3: Index all emails into RAG for semantic search
        yield f"data: {json.dumps({'type': 'status', 'message': 'Indexing emails into RAG system...'})}\n\n"
        indexed = 0
        for email in current_emails:
            if email.get("source") not in ["draft", "mock_draft", "gmail_draft"]:
                rag_service.add_email_context(email, session_id="global")
                indexed += 1
        yield f"data: {json.dumps({'type': 'status', 'message': f'Indexed {indexed} emails for semantic search'})}\n\n"
        
        # Send completion message
        yield f"data: {json.dumps({'type': 'complete', 'message': 'Ingestion complete'})}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

@app.post("/reset")
def reset_inbox():
    """Reset email tags and read status without deleting emails"""
    emails = inbox_service.get_emails()
    
    # Reset all emails except drafts: remove categories, set read to false, clear action items
    for email in emails:
        # Skip drafts - don't reset their category or other properties
        if email.get("source") in ["draft", "mock_draft", "gmail_draft"]:
            continue
            
        email["category"] = None
        email["read"] = False
        email["action_items"] = []
    
    inbox_service.save_emails(emails)
    return {"message": "Inbox reset successfully (tags cleared, marked as unread, drafts preserved)"}

@app.post("/rag/index-emails")
def index_all_emails():
    """Index all current emails into the RAG system for semantic search"""
    emails = inbox_service.get_emails()
    indexed_count = 0
    
    for email in emails:
        # Skip drafts
        if email.get("source") in ["draft", "mock_draft", "gmail_draft"]:
            continue
        
        # Add each email to RAG with a global session (so it's searchable by all)
        rag_service.add_email_context(email, session_id="global")
        indexed_count += 1
    
    return {
        "message": f"Indexed {indexed_count} emails into RAG system",
        "total_emails": len(emails),
        "indexed": indexed_count
    }

@app.post("/oauth/load")
def load_oauth_emails():
    """Reload mock inbox file into the database and return it."""
    emails = inbox_service.load_mock_inbox()
    return {"message": f"Loaded {len(emails)} mock emails into the inbox", "emails": emails}

@app.post("/emails/{email_id}/read")
def mark_email_read(email_id: str):
    emails = inbox_service.get_emails()
    for email in emails:
        if email["id"] == email_id:
            email["read"] = True
            break
    inbox_service.save_emails(emails)
    return {"message": "Email marked as read"}

@app.get("/prompts")
def get_prompts():
    return inbox_service.get_prompts()

@app.post("/prompts")
def update_prompts(prompts: Prompts):
    inbox_service.save_prompts(prompts.dict())
    return {"message": "Prompts updated"}

@app.get("/settings")
def get_settings():
    return inbox_service.get_settings()

@app.post("/settings")
def update_settings(settings: Settings):
    inbox_service.save_settings(settings.dict())
    llm_service.update_settings(
        settings.llm_provider, 
        settings.groq_api_key,
        settings.groq_model,
        settings.ollama_model
    )
    return {"message": "Settings updated"}

@app.post("/chat")
def chat_agent(request: ChatRequest):
    prompts = inbox_service.get_prompts()
    emails = inbox_service.get_emails()
    
    # Generate or use provided session ID
    session_id = request.session_id or str(uuid.uuid4())
    
    # Retrieve relevant context from RAG using semantic search
    # Search across ALL emails and conversations, not just this session
    rag_contexts = rag_service.query_context(
        query=request.message,
        top_k=request.top_k or 10,  # Increased to find more email matches
        session_id=None,  # Search globally, not just this session
        email_id=None
    )
    
    # Build context from RAG results - only emails and action items
    rag_context = ""
    if rag_contexts:
        rag_context = "\n=== Relevant Emails from Your Inbox ===\n"
        for idx, ctx in enumerate(rag_contexts, 1):
            # Only include if distance/similarity is good (lower distance = more similar)
            if ctx.get('distance', 1.0) < 1.2:  # More lenient threshold to include emails
                doc_text = ctx['document']
                
                # Format email context with full details including action items
                rag_context += f"\n[Email {idx}]\n"
                rag_context += f"Category/Tag: {ctx['metadata'].get('email_category', 'N/A')}\n"
                rag_context += f"Subject: {ctx['metadata'].get('email_subject', 'N/A')}\n"
                rag_context += f"From: {ctx['metadata'].get('email_sender', 'N/A')}\n"
                
                # Include the full document text (contains body + action items with delimiters)
                # This ensures action items are properly shown
                if '=== ACTION ITEMS ===' in doc_text:
                    # Document has structured action items, include them prominently
                    rag_context += f"\n{doc_text}\n"
                else:
                    # Just show first part of document
                    rag_context += f"\nContent: {doc_text[:600]}...\n"
        rag_context += "\n=== End Relevant Emails ===\n\n"
    
    context = ""
    email_context = None
    
    # Handle thread context if provided
    if request.thread_email_ids and len(request.thread_email_ids) > 1:
        thread_emails = [e for e in emails if e["id"] in request.thread_email_ids]
        if thread_emails:
            # Sort by timestamp
            thread_emails.sort(key=lambda x: x.get("timestamp", ""))
            context = f"Email Thread ({len(thread_emails)} messages):\n\n"
            for idx, email in enumerate(thread_emails, 1):
                context += f"Message {idx}:\n"
                context += f"From: {email['sender']}\n"
                context += f"Subject: {email['subject']}\n"
                context += f"Date: {email.get('timestamp', 'Unknown')}\n"
                context += f"Body: {email['body']}\n\n"
            context += "---\n\n"
            # Use first email as primary context for RAG storage
            email_context = thread_emails[0] if thread_emails else None
    elif request.email_id:
        # Single email context
        email = next((e for e in emails if e["id"] == request.email_id), None)
        if email:
            context = f"Selected Email:\nFrom: {email['sender']}\nSubject: {email['subject']}\nBody: {email['body']}\n\n"
            email_context = email
            # Add this email to RAG context if not already present
            rag_service.add_email_context(email, session_id=session_id)
    
    # If no specific email, maybe provide a summary of the inbox (simplified for now)
    if not context:
        context = "Context: User is asking about their inbox in general.\n"

    # Combine RAG context with current context
    full_context = rag_context + context
    
    # Build a more direct prompt that emphasizes action items and categories
    prompt = f"""You are a helpful Email Productivity Agent. Answer the user's question based on their emails, action items, and email categories/tags.

IMPORTANT: When responding about action items or tasks:
- List all action items with their deadlines if present
- Mention which email each action item comes from
- If asked about categories/tags, mention the email category

{full_context}

User Question: {request.message}

Answer the question directly and concisely. When referencing emails, include:
- Email subject and sender
- Category/tag if relevant
- Action items with deadlines if present

Answer:"""
    response = llm_service.generate(prompt)
    
    # Note: We don't store chat turns - RAG only contains emails and action items
    
    return {"response": response, "session_id": session_id}

@app.post("/draft")
def generate_draft(request: DraftRequest):
    prompts = inbox_service.get_prompts()
    emails = inbox_service.get_emails()
    email = next((e for e in emails if e["id"] == request.email_id), None)
    
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
        
    auto_reply_prompt = prompts["auto_reply"]["template"]
    
    prompt = f"{auto_reply_prompt}\n\nOriginal Email:\nFrom: {email['sender']}\nSubject: {email['subject']}\nBody: {email['body']}\n\nDraft a reply:"
    
    if request.instructions:
        prompt += f"\nAdditional Instructions: {request.instructions}"
        
    draft_body = llm_service.generate(prompt)
    
    return {
        "subject": f"Re: {email['subject']}",
        "body": draft_body
    }

class SaveDraftRequest(BaseModel):
    subject: str
    body: str
    sender: str = "Ramana@email.com"
    source: str = "mock_draft"

@app.post("/drafts/save")
def save_draft(draft: SaveDraftRequest):
    # Create a new email object for the draft
    import uuid
    from datetime import datetime
    
    new_draft = {
        "id": str(uuid.uuid4()),
        "sender": draft.sender,
        "subject": draft.subject,
        "body": draft.body,
        "timestamp": datetime.now().isoformat(),
        "read": True,
        "category": "Draft",
        "action_items": [],
        "source": draft.source
    }
    
    emails = inbox_service.get_emails()
    emails.append(new_draft)
    inbox_service.save_emails(emails)
    
    return {"message": "Draft saved successfully", "draft": new_draft}

@app.delete("/drafts/{draft_id}")
def delete_draft(draft_id: str):
    """Delete a draft email"""
    emails = inbox_service.get_emails()
    
    for i, email in enumerate(emails):
        if email["id"] == draft_id and email.get("category", "").lower() == "draft":
            emails.pop(i)
            inbox_service.save_emails(emails)
            return {"message": "Draft deleted successfully"}
    
    raise HTTPException(status_code=404, detail="Draft not found")

@app.delete("/emails/{email_id}/tasks/{task_index}")
def delete_action_item(email_id: str, task_index: int):
    """Delete an action item from an email"""
    emails = inbox_service.get_emails()
    
    for email in emails:
        if email["id"] == email_id:
            if "action_items" in email and email["action_items"]:
                if 0 <= task_index < len(email["action_items"]):
                    # Remove the action item
                    email["action_items"].pop(task_index)
                    inbox_service.save_emails(emails)
                    return {"message": "Action item deleted successfully"}
                else:
                    raise HTTPException(status_code=404, detail="Task index out of range")
            else:
                raise HTTPException(status_code=404, detail="No action items found")
    
    raise HTTPException(status_code=404, detail="Email not found")

@app.post("/emails/clear")
def clear_all_indexes():
    inbox_service.clear_all_emails()
    return {"message": "All indexed emails removed."}

# RAG Management Endpoints

@app.post("/rag/reset")
def reset_rag():
    """Reset all RAG indexed emails and action items (use with caution)"""
    rag_service.reset()
    return {"message": "All RAG indexed content has been reset"}

@app.get("/rag/stats")
def get_rag_stats():
    """Get RAG system statistics"""
    try:
        count = rag_service.collection.count()
        return {
            "indexed_documents": count,
            "collection_name": rag_service.collection.name,
            "embedding_model": rag_service.embedding_model
        }
    except Exception as e:
        return {"error": str(e)}

