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
    app_base_url: str = "http://localhost:5173"  # used to build invite / reset links

    # Mail (SMTP relay — configure via env vars or .env)
    mail_enabled: bool = False  # master switch; off in dev/tests → logs instead of sending
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@doen.local"
    smtp_from_name: str = "Doen"
    smtp_use_starttls: bool = True
    smtp_use_tls: bool = False
    mail_invite_expires_days: int = 7

    # Deployment identity & Telegram ops notifications
    app_version: str = "0.0.0-dev"
    pod_name: str = ""
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""


settings = Settings()
