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

    class Config:
        env_file = str(BASE_DIR / ".env")
        case_sensitive = False
        extra = "ignore"


settings = Settings()
