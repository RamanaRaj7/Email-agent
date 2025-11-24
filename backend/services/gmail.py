import base64
import os
import threading
import time
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import getaddresses
from typing import Any, Dict, List, Optional, Tuple

import requests
from fastapi import HTTPException
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google.auth.exceptions import RefreshError
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google_auth_oauthlib.flow import Flow

from services.inbox import inbox_service


class GmailService:
    SCOPES = [
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.send",
    ]

    def __init__(
        self,
        credentials_file: str,
        token_file: str,
        redirect_uri: Optional[str] = None,
    ):
        self.credentials_file = credentials_file
        self.token_file = token_file
        self.redirect_uri = (
            redirect_uri
            or os.getenv("GMAIL_REDIRECT_URI", "http://localhost:8000/gmail/oauth/callback")
        )
        self._creds: Optional[Credentials] = None
        self._pending_states: Dict[str, float] = {}

    # Credential helpers -------------------------------------------------

    def _credentials(self) -> Optional[Credentials]:
        if self._creds and self._creds.valid:
            return self._creds
        if os.path.exists(self.token_file):
            self._creds = Credentials.from_authorized_user_file(self.token_file, self.SCOPES)
        if self._creds and self._creds.expired and self._creds.refresh_token:
            try:
                self._creds.refresh(Request())
                self._save_credentials()
            except RefreshError:
                # Token expired or revoked — clear stored token and credentials
                try:
                    if os.path.exists(self.token_file):
                        os.remove(self.token_file)
                except Exception:
                    pass
                self._creds = None
                return None
        return self._creds

    def _save_credentials(self):
        if self._creds:
            with open(self.token_file, "w") as token:
                token.write(self._creds.to_json())

    def is_authenticated(self) -> bool:
        creds = self._credentials()
        return bool(creds and creds.valid)

    def generate_auth_url(self) -> str:
        if not os.path.exists(self.credentials_file):
            raise HTTPException(status_code=400, detail="Google OAuth client file not found")

        flow = Flow.from_client_secrets_file(
            self.credentials_file, scopes=self.SCOPES, redirect_uri=self.redirect_uri
        )
        auth_url, state = flow.authorization_url(
            access_type="offline", include_granted_scopes="true", prompt="consent"
        )
        self._pending_states[state] = time.time()
        return auth_url

    def finish_auth(self, state: str, code: str):
        if state not in self._pending_states:
            raise HTTPException(status_code=400, detail="Unknown OAuth state")

        flow = Flow.from_client_secrets_file(
            self.credentials_file,
            scopes=self.SCOPES,
            redirect_uri=self.redirect_uri,
            state=state,
        )
        flow.fetch_token(code=code)
        self._creds = flow.credentials
        self._save_credentials()
        profile_email = self._lookup_profile_email()
        if profile_email:
            inbox_service.set_sync_state("gmail_profile_email", profile_email)
        inbox_service.set_sync_state("gmail_last_auth", datetime.now(timezone.utc).isoformat())
        self._pending_states.pop(state, None)

    # Gmail client helpers ----------------------------------------------

    def _service(self):
        creds = self._credentials()
        if not creds:
            raise HTTPException(status_code=401, detail="Connect Gmail first")
        return build("gmail", "v1", credentials=creds, cache_discovery=False)

    def _lookup_profile_email(self) -> Optional[str]:
        try:
            profile = self._service().users().getProfile(userId="me").execute()
            return profile.get("emailAddress")
        except HttpError:
            return None

    # Sync state --------------------------------------------------------

    def get_status(self) -> Dict[str, Any]:
        total = inbox_service.count_emails()
        last_sync = inbox_service.get_sync_state("gmail_last_sync")
        last_manual = inbox_service.get_sync_state("gmail_last_manual_sync")
        email = inbox_service.get_sync_state("gmail_profile_email")
        history_id = inbox_service.get_sync_state("gmail_history_id")

        return {
            "authenticated": self.is_authenticated(),
            "email_address": email,
            "last_sync": last_sync,
            "last_manual_sync": last_manual,
            "history_id": history_id,
            "total_synced": total,
            "scopes": self.SCOPES,
        }

    # Message parsing ---------------------------------------------------

    def _parse_headers(self, payload: Dict[str, Any]) -> Dict[str, str]:
        headers = payload.get("headers", [])
        return {h.get("name", "").lower(): h.get("value", "") for h in headers}

    def _parse_recipients(self, header_value: Optional[str]) -> List[str]:
        if not header_value:
            return []
        addresses = getaddresses([header_value])
        return [addr for _, addr in addresses if addr]

    def _decode_body(self, payload: Dict[str, Any]) -> str:
        data = payload.get("body", {}).get("data")
        if data:
            try:
                return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="ignore")
            except Exception:
                return ""
        parts = payload.get("parts", [])
        for part in parts:
            if part.get("mimeType") == "text/plain":
                return self._decode_body(part)
        if parts:
            return self._decode_body(parts[0])
        return ""

    def _to_email_record(self, message: Dict[str, Any]) -> Dict[str, Any]:
        payload = message.get("payload", {})
        headers = self._parse_headers(payload)
        internal_date = message.get("internalDate")
        timestamp = None
        if internal_date:
            timestamp = datetime.utcfromtimestamp(int(internal_date) / 1000).isoformat()
        label_ids = message.get("labelIds", [])
        body = self._decode_body(payload)
        return {
            "id": message.get("id"),
            "thread_id": message.get("threadId"),
            "message_id": headers.get("message-id"),
            "history_id": message.get("historyId"),
            "sender": headers.get("from"),
            "to": self._parse_recipients(headers.get("to")),
            "cc": self._parse_recipients(headers.get("cc")),
            "bcc": self._parse_recipients(headers.get("bcc")),
            "subject": headers.get("subject"),
            "snippet": message.get("snippet"),
            "body": body,
            "timestamp": timestamp,
            "internal_date": internal_date,
            "read": "UNREAD" not in label_ids,
            "category": self._resolve_category(label_ids),
            "action_items": [],
            "label_ids": label_ids,
            "source": "gmail",
        }

    def _resolve_category(self, label_ids: List[str]) -> str:
        if "SENT" in label_ids:
            return "Sent"
        if "DRAFT" in label_ids:
            return "Draft"
        if "SPAM" in label_ids:
            return "Spam"
        if "TRASH" in label_ids:
            return "Trash"
        return "Inbox"

    # Sync operations ---------------------------------------------------

    def sync_messages(self, full_sync: bool = False, triggered_by: str = "manual") -> Dict[str, Any]:
        if not self.is_authenticated():
            raise HTTPException(status_code=401, detail="Gmail is not connected")

        service = self._service()
        start_history_id = inbox_service.get_sync_state("gmail_history_id")
        synced = 0
        newest_history = start_history_id

        try:
            if full_sync or not start_history_id:
                message_ids = self._list_recent_message_ids(service)
                for msg_id in message_ids:
                    record, history_id = self._fetch_message(service, msg_id)
                    if record:
                        inbox_service.upsert_email(record)
                        synced += 1
                        if history_id and (not newest_history or int(history_id) > int(newest_history or 0)):
                            newest_history = history_id
            else:
                synced, newest_history = self._sync_via_history(service, start_history_id)
        except HttpError as exc:
            if exc.resp.status == 404 and not full_sync:
                return self.sync_messages(full_sync=True, triggered_by=triggered_by)
            raise

        if newest_history:
            inbox_service.set_sync_state("gmail_history_id", str(newest_history))

        timestamp = datetime.now(timezone.utc).isoformat()
        inbox_service.set_sync_state("gmail_last_sync", timestamp)
        if triggered_by == "manual":
            inbox_service.set_sync_state("gmail_last_manual_sync", timestamp)

        return {
            "synced": synced,
            "full_sync": full_sync or not start_history_id,
            "history_id": newest_history,
            "last_sync": timestamp,
        }

    def _list_recent_message_ids(self, service) -> List[str]:
        ids: List[str] = []
        page_token = None
        while len(ids) < 20:
            response = (
                service.users()
                .messages()
                .list(
                    userId="me",
                    maxResults= min(20 - len(ids), 200),
                    q="newer_than:60d",
                    pageToken=page_token,
                )
                .execute()
            )
            ids.extend([msg["id"] for msg in response.get("messages", [])])
            if len(ids) >= 20:
                break
            page_token = response.get("nextPageToken")
            if not page_token:
                break
        return ids[:20]

    def _fetch_message(self, service, message_id: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        message = (
            service.users().messages().get(userId="me", id=message_id, format="full").execute()
        )
        record = self._to_email_record(message)
        return record, message.get("historyId")

    def _sync_via_history(self, service, start_history_id: str) -> Tuple[int, Optional[str]]:
        synced = 0
        newest_history = start_history_id
        page_token = None
        while True:
            history = (
                service.users()
                .history()
                .list(
                    userId="me",
                    startHistoryId=start_history_id,
                    historyTypes=["messageAdded"],
                    pageToken=page_token,
                )
                .execute()
            )
            for item in history.get("history", []):
                for added in item.get("messagesAdded", []):
                    msg_id = added["message"]["id"]
                    record, history_id = self._fetch_message(service, msg_id)
                    if record:
                        inbox_service.upsert_email(record)
                        synced += 1
                        if history_id and int(history_id) > int(newest_history or 0):
                            newest_history = history_id
            page_token = history.get("nextPageToken")
            if not page_token:
                if history.get("historyId"):
                    newest_history = history["historyId"]
                break
        return synced, newest_history

    def logout(self):
        creds = self._credentials()
        if creds and creds.token:
            try:
                requests.post(
                    "https://oauth2.googleapis.com/revoke",
                    params={"token": creds.token},
                    headers={"content-type": "application/x-www-form-urlencoded"},
                    timeout=10,
                )
            except requests.RequestException:
                pass
        if os.path.exists(self.token_file):
            os.remove(self.token_file)
        self._creds = None
        # Clear Gmail emails by clearing gmail_inbox.json
        import json
        from services.inbox import GMAIL_INBOX_FILE
        with open(GMAIL_INBOX_FILE, 'w') as f:
            json.dump([], f)
        for key in [
            "gmail_profile_email",
            "gmail_last_sync",
            "gmail_last_manual_sync",
            "gmail_history_id",
            "gmail_last_auth",
        ]:
            inbox_service.delete_sync_state(key)

    # Sending -----------------------------------------------------------

    def send_message(
        self,
        *,
        to: List[str],
        subject: str,
        body: str,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        thread_id: Optional[str] = None,
        in_reply_to: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not to:
            raise HTTPException(status_code=400, detail="Recipient is required")

        service = self._service()
        from_address = inbox_service.get_sync_state("gmail_profile_email") or self._lookup_profile_email()
        if not from_address:
            raise HTTPException(status_code=400, detail="Unable to determine Gmail address")

        message = EmailMessage()
        message["To"] = ", ".join(to)
        message["From"] = from_address
        if cc:
            message["Cc"] = ", ".join(cc)
        if bcc:
            message["Bcc"] = ", ".join(bcc)
        if in_reply_to:
            message["In-Reply-To"] = in_reply_to
            message["References"] = in_reply_to
        message["Subject"] = subject
        message.set_content(body)

        encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
        send_body: Dict[str, Any] = {"raw": encoded_message}
        if thread_id:
            send_body["threadId"] = thread_id

        sent = service.users().messages().send(userId="me", body=send_body).execute()
        record, history_id = self._fetch_message(service, sent["id"])
        if record:
            inbox_service.upsert_email(record)
            if history_id:
                inbox_service.set_sync_state("gmail_history_id", str(history_id))

        return {"message_id": sent.get("id"), "thread_id": sent.get("threadId")}
