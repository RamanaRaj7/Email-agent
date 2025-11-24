import os
import uuid
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
import ollama
from datetime import datetime


class RAGService:
    """
    RAG service for email semantic search using Ollama embeddinggemma and ChromaDB.
    Stores email content and action items for semantic retrieval.
    Does NOT store chat history - only email and action item context.
    """
    
    def __init__(self, persist_directory: str = None):
        # Default to DATA_DIR/chroma_db
        if persist_directory is None:
            from services.inbox import DATA_DIR
            persist_directory = os.path.join(DATA_DIR, "chroma_db")
        
        os.makedirs(persist_directory, exist_ok=True)
        
        # Initialize ChromaDB with persistence
        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=ChromaSettings(
                anonymized_telemetry=False,
                allow_reset=True
            )
        )
        
        # Create or get collection for chat history
        self.collection = self.client.get_or_create_collection(
            name="email_chat_history",
            metadata={"description": "Email and action items context for semantic search"}
        )
        
        self.embedding_model = "embeddinggemma:latest"
    
    def _generate_embedding(self, text: str) -> List[float]:
        """Generate embedding using Ollama's embeddinggemma model"""
        try:
            response = ollama.embeddings(model=self.embedding_model, prompt=text)
            return response['embedding']
        except Exception as e:
            print(f"Error generating embedding: {e}")
            # Fallback: return zero vector if embedding fails
            return [0.0] * 768  # embeddinggemma typically has 768 dimensions
    
    def add_chat_turn(
        self,
        user_message: str,
        assistant_response: str,
        email_context: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None
    ) -> str:
        """
        Add a chat turn (user message + assistant response) to the vector store.
        Returns the document ID.
        """
        # Create unique ID for this chat turn
        doc_id = str(uuid.uuid4())
        
        # Prepare metadata
        metadata = {
            "timestamp": datetime.now().isoformat(),
            "type": "chat_turn",
            "user_message": user_message[:500],  # Store preview in metadata
            "assistant_response": assistant_response[:500],
        }
        
        if session_id:
            metadata["session_id"] = session_id
        
        if email_context:
            metadata["email_id"] = email_context.get("id", "")
            metadata["email_subject"] = email_context.get("subject", "")[:200]
            metadata["email_sender"] = email_context.get("sender", "")[:200]
        
        # Combine user message and assistant response for embedding
        # This captures the full conversation context
        combined_text = f"User: {user_message}\nAssistant: {assistant_response}"
        
        if email_context:
            # Include email context in the embedding
            email_text = f"\nEmail Context - Subject: {email_context.get('subject', '')}\n"
            email_text += f"From: {email_context.get('sender', '')}\n"
            email_text += f"Body: {email_context.get('body', '')[:1000]}"
            combined_text += email_text
        
        # Generate embedding
        embedding = self._generate_embedding(combined_text)
        
        # Add to ChromaDB
        self.collection.add(
            ids=[doc_id],
            embeddings=[embedding],
            documents=[combined_text],
            metadatas=[metadata]
        )
        
        return doc_id
    
    def add_email_context(
        self,
        email: Dict[str, Any],
        session_id: Optional[str] = None
    ) -> str:
        """
        Add email content to the vector store for future reference.
        This is useful when a user views/selects an email.
        """
        doc_id = str(uuid.uuid4())
        
        metadata = {
            "timestamp": datetime.now().isoformat(),
            "type": "email_context",
            "email_id": email.get("id", ""),
            "email_subject": (email.get("subject", "") or "")[:200],
            "email_sender": (email.get("sender", "") or "")[:200],
            "email_category": (email.get("category", "") or "")[:100],
            "source": email.get("source", "unknown")  # Track if gmail or mock inbox
        }
        
        if session_id:
            metadata["session_id"] = session_id
        
        # Create text representation of email with detailed action items and tags
        category = email.get('category') or 'Uncategorized'
        email_text = f"Category/Tag: {category}\n"
        email_text += f"Subject: {email.get('subject', '')}\n"
        email_text += f"From: {email.get('sender', '')}\n"
        
        # Include recipients if present
        recipients = email.get('to', [])
        if recipients:
            email_text += f"To: {', '.join(recipients)}\n"
        
        email_text += f"\nEmail Body:\n{email.get('body', '')}\n"
        
        # Add detailed action items if present
        action_items = email.get('action_items', [])
        if action_items and len(action_items) > 0:
            email_text += "\n=== ACTION ITEMS ===\n"
            for idx, item in enumerate(action_items, 1):
                task = item.get('task', '')
                deadline = item.get('deadline', '')
                if deadline:
                    email_text += f"{idx}. {task} (Deadline: {deadline})\n"
                else:
                    email_text += f"{idx}. {task}\n"
            email_text += "=== END ACTION ITEMS ===\n"
        
        embedding = self._generate_embedding(email_text)
        
        self.collection.add(
            ids=[doc_id],
            embeddings=[embedding],
            documents=[email_text],
            metadatas=[metadata]
        )
        
        return doc_id
    
    def query_context(
        self,
        query: str,
        top_k: int = 5,
        session_id: Optional[str] = None,
        email_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Query the vector store for relevant context.
        Returns top-k most relevant documents with their metadata.
        """
        # Generate embedding for the query
        query_embedding = self._generate_embedding(query)
        
        # Build where filter if needed
        where_filter = None
        if session_id and email_id:
            where_filter = {
                "$or": [
                    {"session_id": session_id},
                    {"email_id": email_id}
                ]
            }
        elif session_id:
            where_filter = {"session_id": session_id}
        elif email_id:
            where_filter = {"email_id": email_id}
        
        # Query ChromaDB
        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, self.collection.count()),
                where=where_filter,
                include=["documents", "metadatas", "distances"]
            )
            
            # Format results
            contexts = []
            if results and results['ids'] and len(results['ids']) > 0:
                for i in range(len(results['ids'][0])):
                    contexts.append({
                        "id": results['ids'][0][i],
                        "document": results['documents'][0][i],
                        "metadata": results['metadatas'][0][i],
                        "distance": results['distances'][0][i]
                    })
            
            return contexts
        except Exception as e:
            print(f"Error querying context: {e}")
            return []
    
    def get_conversation_history(
        self,
        session_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get recent conversation history for a session.
        Returns most recent chat turns.
        """
        try:
            results = self.collection.get(
                where={"session_id": session_id, "type": "chat_turn"},
                limit=limit,
                include=["documents", "metadatas"]
            )
            
            history = []
            if results and results['ids']:
                for i in range(len(results['ids'])):
                    history.append({
                        "id": results['ids'][i],
                        "document": results['documents'][i],
                        "metadata": results['metadatas'][i]
                    })
                
                # Sort by timestamp (most recent last)
                history.sort(key=lambda x: x['metadata'].get('timestamp', ''))
            
            return history
        except Exception as e:
            print(f"Error getting conversation history: {e}")
            return []
    
    def clear_session(self, session_id: str):
        """Clear all documents for a specific session"""
        try:
            # Get all IDs for this session
            results = self.collection.get(
                where={"session_id": session_id},
                include=[]
            )
            
            if results and results['ids']:
                self.collection.delete(ids=results['ids'])
        except Exception as e:
            print(f"Error clearing session: {e}")
    
    def reset(self):
        """Reset the entire collection (use with caution)"""
        try:
            self.client.delete_collection(name="email_chat_history")
            self.collection = self.client.get_or_create_collection(
                name="email_chat_history",
                metadata={"description": "Email chat conversation history with RAG context"}
            )
        except Exception as e:
            print(f"Error resetting collection: {e}")
    
    def clear_gmail_embeddings(self):
        """Clear only Gmail email embeddings when user disconnects from Gmail"""
        try:
            # Query for all Gmail emails (source=gmail in metadata)
            results = self.collection.get(
                where={"source": "gmail"}
            )
            
            if results and results['ids']:
                self.collection.delete(ids=results['ids'])
                print(f"Cleared {len(results['ids'])} Gmail email embeddings from RAG")
            else:
                print("No Gmail embeddings found to clear")
        except Exception as e:
            print(f"Error clearing Gmail embeddings: {e}")
    
    def clear_mock_inbox_embeddings(self):
        """Clear only mock inbox embeddings when user logs in to Gmail"""
        try:
            # Query for all mock inbox emails (source=ingestion in metadata)
            results = self.collection.get(
                where={"source": "ingestion"}
            )
            
            if results and results['ids']:
                self.collection.delete(ids=results['ids'])
                print(f"Cleared {len(results['ids'])} mock inbox email embeddings from RAG")
            else:
                print("No mock inbox embeddings found to clear")
        except Exception as e:
            print(f"Error clearing mock inbox embeddings: {e}")


# Singleton instance
rag_service = RAGService()
