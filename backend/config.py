from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent


class Settings(BaseSettings):
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2:3b"

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    secret_key: str = "aria-dev-secret"

    sqlite_db_path: str = str(BASE_DIR / "data" / "sqlite" / "aria.db")
    chroma_db_path: str = str(BASE_DIR / "data" / "chroma")

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "aria-neo4j-password"

    tier1_model: str = "llama3.2:3b"
    tier2_model: str = "qwen2.5:14b"
    tier3_model: str = "gemini-2.0-flash"
    tier3_api_key: str = ""
    tier3_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai/"

    class Config:
        env_file = str(BASE_DIR / ".env")
        case_sensitive = False
        extra = "ignore"


settings = Settings()
