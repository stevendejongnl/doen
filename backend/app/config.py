from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Database
    db_mode: str = "sqlite"  # "sqlite" or "postgres"
    database_url: str = "sqlite+aiosqlite:///./doen.db"

    # Auth
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    # Home Assistant OAuth
    ha_base_url: str = ""
    ha_client_id: str = ""
    ha_client_secret: str = ""

    # App
    app_name: str = "Doen"
    debug: bool = False
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:8000"]


settings = Settings()
