import json
import os
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
INBOX_FILE = os.path.join(DATA_DIR, "inbox.json")
GMAIL_INBOX_FILE = os.path.join(DATA_DIR, "gmail_inbox.json")
DRAFTS_FILE = os.path.join(DATA_DIR, "drafts.json")
GMAIL_DRAFTS_FILE = os.path.join(DATA_DIR, "gmail_drafts.json")
PROMPTS_FILE = os.path.join(DATA_DIR, "prompts.json")
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")
SYNC_STATE_FILE = os.path.join(DATA_DIR, "sync_state.json")

class InboxService:
    def __init__(self):
        self._ensure_files()

    def _ensure_files(self):
        """Ensure all JSON files exist."""
        os.makedirs(DATA_DIR, exist_ok=True)
        if not os.path.exists(INBOX_FILE):
            with open(INBOX_FILE, 'w') as f:
                json.dump([], f)
        if not os.path.exists(GMAIL_INBOX_FILE):
            with open(GMAIL_INBOX_FILE, 'w') as f:
                json.dump([], f)
        if not os.path.exists(DRAFTS_FILE):
            with open(DRAFTS_FILE, 'w') as f:
                json.dump([], f)
        if not os.path.exists(GMAIL_DRAFTS_FILE):
            with open(GMAIL_DRAFTS_FILE, 'w') as f:
                json.dump([], f)
        if not os.path.exists(SYNC_STATE_FILE):
            with open(SYNC_STATE_FILE, 'w') as f:
                json.dump({}, f)

    def get_emails(self) -> List[Dict]:
        """Get all emails (mock + gmail combined)."""
        mock_emails = []
        gmail_emails = []
        mock_drafts = []
        gmail_drafts = []
        
        if os.path.exists(INBOX_FILE):
            with open(INBOX_FILE, 'r') as f:
                mock_emails = json.load(f)
        
        if os.path.exists(GMAIL_INBOX_FILE):
            with open(GMAIL_INBOX_FILE, 'r') as f:
                gmail_emails = json.load(f)
        
        if os.path.exists(DRAFTS_FILE):
            with open(DRAFTS_FILE, 'r') as f:
                mock_drafts = json.load(f)
        
        if os.path.exists(GMAIL_DRAFTS_FILE):
            with open(GMAIL_DRAFTS_FILE, 'r') as f:
                gmail_drafts = json.load(f)
        
        # Combine all lists
        return mock_emails + gmail_emails + mock_drafts + gmail_drafts

    def save_emails(self, emails: List[Dict]):
        """Save emails to appropriate files based on source."""
        # Gmail emails go to gmail_inbox.json
        gmail_emails = [e for e in emails if e.get("source") == "gmail"]
        # Gmail drafts go to gmail_drafts.json
        gmail_drafts = [e for e in emails if e.get("source") == "gmail_draft"]
        # Mock/system drafts go to drafts.json
        mock_drafts = [e for e in emails if e.get("source") in ["draft", "mock_draft"]]
        # Everything else (mock, system, ingestion) goes to inbox.json
        mock_emails = [e for e in emails if e.get("source") not in ["gmail", "gmail_draft", "draft", "mock_draft"]]
        
        with open(INBOX_FILE, 'w') as f:
            json.dump(mock_emails, f, indent=2)
        
        with open(GMAIL_INBOX_FILE, 'w') as f:
            json.dump(gmail_emails, f, indent=2)
        
        with open(DRAFTS_FILE, 'w') as f:
            json.dump(mock_drafts, f, indent=2)
        
        with open(GMAIL_DRAFTS_FILE, 'w') as f:
            json.dump(gmail_drafts, f, indent=2)

    def get_prompts(self) -> Dict:
        with open(PROMPTS_FILE, 'r') as f:
            return json.load(f)

    def save_prompts(self, prompts: Dict):
        with open(PROMPTS_FILE, 'w') as f:
            json.dump(prompts, f, indent=2)

    def get_settings(self) -> Dict:
        with open(SETTINGS_FILE, 'r') as f:
            return json.load(f)

    def save_settings(self, settings: Dict):
        with open(SETTINGS_FILE, 'w') as f:
            json.dump(settings, f, indent=2)

    def upsert_email(self, email: Dict):
        """Add or update a single email."""
        emails = self.get_emails()
        for i, existing in enumerate(emails):
            if existing.get("id") == email.get("id"):
                emails[i] = email
                self.save_emails(emails)
                return
        emails.append(email)
        self.save_emails(emails)

    def upsert_many(self, new_emails: List[Dict]):
        """Add or update multiple emails."""
        emails = self.get_emails()
        email_map = {e.get("id"): e for e in emails}
        for new_email in new_emails:
            email_map[new_email.get("id")] = new_email
        self.save_emails(list(email_map.values()))

    def get_email(self, email_id: str) -> Optional[Dict]:
        """Get a single email by ID."""
        emails = self.get_emails()
        for email in emails:
            if email.get("id") == email_id:
                return email
        return None

    def count_emails(self) -> int:
        """Count total emails."""
        return len(self.get_emails())

    def clear_all_emails(self):
        """Clear all emails."""
        with open(INBOX_FILE, 'w') as f:
            json.dump([], f)
        with open(GMAIL_INBOX_FILE, 'w') as f:
            json.dump([], f)
        with open(DRAFTS_FILE, 'w') as f:
            json.dump([], f)
        with open(GMAIL_DRAFTS_FILE, 'w') as f:
            json.dump([], f)

    def get_sync_state(self, key: str) -> Optional[str]:
        """Get a sync state value."""
        with open(SYNC_STATE_FILE, 'r') as f:
            state = json.load(f)
        return state.get(key)

    def set_sync_state(self, key: str, value: str):
        """Set a sync state value."""
        with open(SYNC_STATE_FILE, 'r') as f:
            state = json.load(f)
        state[key] = value
        with open(SYNC_STATE_FILE, 'w') as f:
            json.dump(state, f, indent=2)

    def delete_sync_state(self, key: str):
        """Delete a sync state value."""
        with open(SYNC_STATE_FILE, 'r') as f:
            state = json.load(f)
        state.pop(key, None)
        with open(SYNC_STATE_FILE, 'w') as f:
            json.dump(state, f, indent=2)

    def load_mock_inbox(self) -> List[Dict]:
        """Load mock emails from inbox.json."""
        if not os.path.exists(INBOX_FILE):
            return []
        with open(INBOX_FILE, 'r') as f:
            emails = json.load(f)
        # Only clear and reload mock emails, leave Gmail inbox untouched
        with open(INBOX_FILE, 'w') as f:
            json.dump(emails, f, indent=2)
        return emails

inbox_service = InboxService()
