# Email Productivity Agent

An intelligent, prompt-driven Email Productivity Agent built with Next.js and FastAPI.

## Features (satisfied all the requirements mentioned)
- **Prompt-Driven Architecture**: Customize the agent's behavior (Categorization, Action Extraction, Auto-Reply) via the "Prompt Brain" UI.
- **Email Ingestion**: Load a mock inbox or gmail inbox and process emails using LLMs(Categorization, Action Extraction).
- **Email Agent with RAG**: Chat with your inbox using vector embedding on your inbox powered by ChromaDB and embeddinggemma.
- **Draft Generation**: Auto-generate replies based on your persona.
- **LLM Support**: Supports local **Ollama** (llama3.1:8b or any of your preferred model) and **Groq** API.
- **Gmail Integration**: Connect to Gmail, sync messages, and send emails directly.

## Prerequisites
- Node.js 18+
- Python 3.10+
- [Ollama](https://ollama.com/) (for local LLM)
  - Run `ollama serve`
  - Run `ollama pull llama3.1:8b`(for LLM or Use Groq API)
  - Run `ollama pull embeddinggemma:latest` (for RAG system)

## Setup & Running

### 1. Backend (Python/FastAPI)
The backend handles email processing and LLM interactions.

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The backend will run at `http://localhost:8000`.

### 2. Frontend (Next.js)
The frontend provides the user interface.

```bash
cd frontend
npm install
npm run dev
```

The frontend will run at `http://localhost:3000`.

## Usage Guide

### Sidebar Navigation

The left sidebar contains navigation tabs to access different features:

**Main Tabs:**
- **Inbox** : View all received emails with categorization and action items. Select an email to chat with the Email Agent.
- **Drafts** : View saved email drafts that you haven't sent yet.
- **Sent** : View emails you've sent.
- **Spam** : View emails marked as spam after Ingestion categorization.
- **Compose** : Click to open the email composer to write and send new emails with AI assistance.

**Feature Tabs:**
- **Action Items** : View all extracted action items and deadlines from your emails in one place. Filter and prioritize tasks.
- **Email Chat** : General AI chat interface for asking questions about your emails. Uses RAG to give responses.("eg:what did x mail be about?")
- **Prompt Brain** : Customize how the agent works by editing three main prompts:
  - **Categorization Prompt**: How emails get categorized (Work, Personal, etc.)
  - **Action Extraction Prompt**: How action items and deadlines are identified
  - **Auto-Reply Prompt**: How draft responses are generated
- **Settings** : Switch between LLM providers (Ollama local or Groq API) and configure your LLM models.

### Top Header Buttons

The header displays context-specific buttons depending on which tab you're in:

**For Inbox/Drafts/Sent/Spam tabs:**
- **Sync Inbox** (Gmail only): Manually sync your Gmail inbox to pull the latest messages. Shows a spinning icon while syncing (happens automatically while logging in to your gmail account).
- **Reset Ingestion**: Clears all indexed emails and resets the vector database. Use this to start fresh with ingestion for testing the functionality.
- **Run Ingestion**: Processes emails through the pipeline:
  1. Categorizes each email based on prompt Brain prompt (Work, Personal, Spam, etc.)
  2. Extracts action items and deadlines
  3. Generates vector embeddings using embeddinggemma
  4. Stores embeddings in ChromaDB
- **Email Agent** (toggle): Shows/hides the Email Agent chat panel on the right side for conversing about selected emails you can also have conversation with threaded emails

### Workflow Steps

1.  **Load and sync Inbox**: Automatically happens when you login to your gmail account for mock inbox already loaded while starting the project.
2.  **Run Ingestion**: Go to the "Inbox" tab and click "Run Ingestion". This will process emails using the default prompts and categorize them and create action items and this also creates a vector embeddings for the email and save it in the vector store(chromaDB) (This will few minutes to complete).
3.  **Configure Prompts**: Go to the "Prompt Brain" tab to edit how the agent categorizes emails or extracts tasks.
4.  **Chat with Agent**: Select an email in the Inbox to open the "Email Agent" chat on the right. Ask "Summarize this" or "What should I do?".
5.  **Draft Reply**: Click "Draft Reply" on an email to generate a response based on the Auto-Reply prompt.
6.  **Settings**: Click the Settings icon (bottom left) to switch between Ollama and Groq.

## Gmail Integration

⚠️ **IMPORTANT: Gmail API Credentials Required** 

if you don't have this you can test out the functionalities on the mock inbox

To use Gmail functionality, you must set up OAuth credentials from Google Cloud with Gmail API enabled. **Without these credentials, Gmail login will not work.**

### Prerequisites - Google Cloud Credentials Setup

**Step 1: Enable Gmail API**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Search for "Gmail API" and click **Enable**

**Step 2: Create OAuth Credentials**
1. Go to "APIs & Services" → "Credentials"
2. Click **Create Credentials** → **OAuth Client ID**
3. Select **Desktop** application (for local testing) and give access to you test email.
4. Download the JSON file

**Step 3: Add credentials.json to Project**
1. Rename the downloaded file to `credentials.json`
2. Place it at the project root: `/ocean-ai/credentials.json`

**Step 4: Configure Redirect URI**
- In Google Cloud Console, go to OAuth consent screen
- Add authorized redirect URI: `http://localhost:8000/gmail/oauth/callback`

### Using Gmail Features

Once credentials are set up:

1. **Connect Gmail**
   - Start the backend and frontend
   - Use the Gmail status card (below the header) and click **Connect Gmail**
   - Approve the requested scopes (`gmail.modify`, `gmail.send`, `gmail.readonly`)

2. **What Happens When Connected**
   - Gmail emails are automatically synced and indexed to RAG
   - Mock inbox embeddings are cleared from vector database
   - All Gmail emails become searchable via Email Agent

3. **Sync & Send**
   - **Manual Sync**: Click to refresh emails
   - **Auto Sync**: Runs every 5 minutes by default
   - **Send**: Use Compose or Reply buttons to send emails
   - All tokens securely stored in `backend/data/gmail_token.json` (git-ignored)

4. **Disconnect Gmail**
   - Click **Disconnect Gmail** on status card
   - Gmail embeddings automatically removed from RAG
   - System reverts to mock inbox

## RAG System (Agentic Email Search)

The email chat includes a powerful RAG (Retrieval-Augmented Generation) system that provides intelligent email search and context-aware responses:

- **Email Semantic Search**: Uses `embeddinggemma` to find contextually relevant emails from your inbox
- **Action Item Integration**: Automatically includes extracted tasks and deadlines in search results
- **ChromaDB Vector Store**: Efficient persistent vector database for fast email retrieval


### Quick Setup

ChromaDB is already installed in `requirements.txt`. Just ensure you have the embedding model:

```bash
# Pull the embedding model (one-time setup)
ollama pull embeddinggemma:latest
```

Then run ingestion to index your emails:
1. Start the backend: `uvicorn main:app --reload --port 8000`
2. Open frontend: `http://localhost:3000`
3. Click "Run Ingestion" in the Inbox tab
4. The system will categorize, extract actions, and index all emails to the RAG system

### How It Works

**Three-Phase Ingestion Pipeline:**

1. **Phase 1 - Categorization**: LLM categorizes each email (Work, Personal, Newsletter, etc.)
2. **Phase 2 - Action Items**: LLM extracts tasks with deadlines from each email
3. **Phase 3 - RAG Indexing**: Emails are converted to embeddings and stored in ChromaDB

**When You Ask a Question:**

1. Your question is converted to an embedding using `embeddinggemma`
2. ChromaDB searches for semantically similar emails in your inbox
3. Top-K most relevant emails are retrieved with action items highlighted
4. These emails are sent to the LLM as context
5. The agent generates a response based on your actual email content

**Example:**

Query: *"What tasks do I need to complete this week?"*

Response includes:
- All action items from relevant Work emails
- Deadlines and priorities
- Which email each task came from
- Email categories and senders

### Using the Email Agent

1. **Select an Email**: Click any email in the inbox
2. **Open Agent Chat**: The chat panel appears on the right
3. **Ask Questions**:
   - "Summarize this email"
   - "What tasks do I need to do?"
   - "What is this about?"
   - "Draft a reply to this"
   - **General queries**: Ask any question about your inbox. The agent uses RAG to search your emails and finds relevant results. Examples:
     - "Show me all urgent emails"
     - "What meetings do I have?"
     - "Which emails are about the budget?"

### Configuration

- **Embedding Model**: `embeddinggemma:latest` (768 dimensions, local Ollama)
- **Vector Store**: ChromaDB at `backend/data/chroma_db/` (persistent)
- **Index Scope**: Only Gmail emails when logged in, mock inbox otherwise

### Key Endpoints

```bash
# Trigger email indexing (called automatically during /ingest)
POST /rag/index-emails

# Get RAG system statistics
GET /rag/stats
# Returns: total_emails_indexed, embedding_model, storage_path

# Reset RAG system (clears all vectors)
POST /rag/reset

# Chat with email context (includes RAG search)
POST /chat
```


