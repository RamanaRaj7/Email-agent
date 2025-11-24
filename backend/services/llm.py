import os
import json
import ollama
from groq import Groq
from typing import Optional

class LLMService:
    def __init__(self):
        self.provider = "ollama"
        self.groq_client = None
        self.model = "llama3.1:8b" # Default for Ollama
        self.groq_model = "llama-3.1-8b-instant" # Default for Groq

    def update_settings(self, provider: str, groq_api_key: Optional[str] = None, groq_model: Optional[str] = None, ollama_model: Optional[str] = None):
        self.provider = provider
        if groq_model:
            self.groq_model = groq_model
        if ollama_model:
            self.model = ollama_model
            
        if provider == "groq" and groq_api_key:
            self.groq_client = Groq(api_key=groq_api_key)

    def generate(self, prompt: str) -> str:
        if self.provider == "ollama":
            try:
                response = ollama.generate(model=self.model, prompt=prompt)
                return response['response']
            except Exception as e:
                return f"Error calling Ollama: {str(e)}"
        elif self.provider == "groq":
            if not self.groq_client:
                return "Error: Groq API Key not configured."
            try:
                chat_completion = self.groq_client.chat.completions.create(
                    messages=[
                        {
                            "role": "user",
                            "content": prompt,
                        }
                    ],
                    model=self.groq_model,
                )
                return chat_completion.choices[0].message.content
            except Exception as e:
                return f"Error calling Groq: {str(e)}"
        return "Error: Invalid provider."

llm_service = LLMService()
