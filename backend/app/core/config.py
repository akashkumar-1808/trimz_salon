from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
import os
import json

class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    # Supabase Configuration
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Database: Supports SQLite for zero-config local testing or PostgreSQL / Supabase
    DATABASE_URL: str = "sqlite+aiosqlite:///./trimz.db"

    # Security
    JWT_SECRET: str = "trimz_salon_production_jwt_secret_key_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Storage
    STORAGE_DIR: str = "storage"
    BASE_URL: str = "http://127.0.0.1:8000"
    FRONTEND_URL: str = "https://trimz-salon.vercel.app"

    # Meta WhatsApp Cloud API Configuration
    META_WHATSAPP_PHONE_NUMBER_ID: str = ""
    META_WHATSAPP_ACCESS_TOKEN: str = ""
    META_WHATSAPP_BUSINESS_ACCOUNT_ID: str = ""
    META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: str = "trimz_webhook_verify_token_2026"
    META_WHATSAPP_APP_SECRET: str = ""
    META_WHATSAPP_API_VERSION: str = "v20.0"

    # CORS
    CORS_ORIGINS: Union[str, List[str]] = "http://localhost:3000,http://127.0.0.1:3000,https://trimz-salon.vercel.app"

    @property
    def cors_origins_list(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        if isinstance(self.CORS_ORIGINS, str):
            if self.CORS_ORIGINS.startswith("["):
                try:
                    return json.loads(self.CORS_ORIGINS)
                except Exception:
                    pass
            return [x.strip() for x in self.CORS_ORIGINS.split(",") if x.strip()]
        return ["*"]

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
