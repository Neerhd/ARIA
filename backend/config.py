from pydantic_settings import BaseSettings
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent


class Settings(BaseSettings):
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    secret_key: str = "aria-dev-secret"

    sqlite_db_path: str = str(BASE_DIR / "data" / "sqlite" / "aria.db")
    chroma_db_path: str = str(BASE_DIR / "data" / "chroma")

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "aria-neo4j-password"

    # AI provider API keys — leave blank to disable a provider. The first
    # configured provider (in router_service priority order) is the default.
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    google_api_key: str = ""
    xai_api_key: str = ""
    perplexity_api_key: str = ""

    searxng_base_url: str = "http://localhost:8080"

    class Config:
        env_file = str(BASE_DIR / ".env")
        case_sensitive = False
        extra = "ignore"


settings = Settings()
