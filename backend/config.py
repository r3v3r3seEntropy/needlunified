# config.py

import os

class Config:
    """
    Central configuration for the unified Flask app.
    In production, store actual secrets in environment variables
    or a secure secrets manager, not in plain text.
    """
    # -------------------------
    # Flask App & Session
    # -------------------------
    SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", "super-secret-key")
    SESSION_TYPE = "filesystem"  # or "redis", etc.

    # -------------------------
    # Google OAuth
    # -------------------------
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "160011252982-lced0v3c9inj6cqkcoihlc7tlgbfbjkk.apps.googleusercontent.com")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "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")
    GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "http://localhost:5000/auth/google/callback")
    GOOGLE_SCOPES = [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email"
    ]

    # -------------------------
    # Whereby
    # -------------------------
    WHEREBY_API_KEY = os.environ.get(
        "WHEREBY_API_KEY", 
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmFwcGVhci5pbiIsImF1ZCI6Imh0dHBzOi8vYXBpLmFwcGVhci5pbi92MSIsImV4cCI6OTAwNzE5OTI1NDc0MDk5MSwiaWF0IjoxNzM0OTQ1NjYxLCJvcmdhbml6YXRpb25JZCI6Mjk5MDA1LCJqdGkiOiI1MzcyMTE4MC1iMGJkLTQzY2ItYjkyOS0zZGI2MDQ4MTZkOWEifQ.tjXq3vrGBMPc7XMAb1P2YJBJhpRNcejUyk_d0BC17A4"
    )
    WHEREBY_BASE_URL = "https://api.whereby.dev/v1"

    # -------------------------
    # Gemini (Google Generative AI) 
    # Note: You'll adjust the model name if needed
    # -------------------------
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyD_N0k6G4npGeuAcaGIfnyA20SDl5tZ3C0")
    GEMINI_MODEL = "gemini-2.0-flash-exp"

    # -------------------------
    # Groq-based OpenAI
    # -------------------------
    GROQ_API_KEY = os.environ.get(
        "GROQ_API_KEY",
        "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"
    )
    # Example model (LLama-based)
    GROQ_MODEL = "llama-3.1-8b-instant"

    # -------------------------
    # openrouter.ai-based OpenAI
    # for summary generation
    # -------------------------
    OPENROUTER_API_KEY = os.environ.get(
        "OPENROUTER_API_KEY",
        "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"
    )
    OPENROUTER_MODEL = "openai/o1-preview"

    # -------------------------
    # Uploads & Misc
    # -------------------------
    UPLOAD_DIR = "uploads"
    MAX_UPLOAD_SIZE_MB = 50

    # Which port to run Flask server (if not using gunicorn or similar)
    FLASK_PORT = int(os.environ.get("FLASK_PORT", "5000"))

    # You can add more configuration variables as needed
