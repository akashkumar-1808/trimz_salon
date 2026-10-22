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

    @field_validator("SUPABASE_URL", mode="before")
    @classmethod
    def resolve_supabase_url(cls, v: Union[str, None]) -> str:
        import urllib.parse
        url = (
            v
            or os.getenv("SUPABASE_URL")
            or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            or os.getenv("SUPABASE_PROJECT_URL")
            or ""
        ).strip().strip("'\"")
        if not url:
            from dotenv import dotenv_values
            env_vals = dotenv_values(".env") or dotenv_values("backend/.env")
            url = (
                env_vals.get("SUPABASE_URL")
                or env_vals.get("NEXT_PUBLIC_SUPABASE_URL")
                or ""
            ).strip().strip("'\"")
        if url:
            parsed = urllib.parse.urlparse(url)
            if parsed.scheme and parsed.netloc:
                url = f"{parsed.scheme}://{parsed.netloc}"
        return url

    @field_validator("SUPABASE_KEY", mode="before")
    @classmethod
    def resolve_supabase_key(cls, v: Union[str, None]) -> str:
        key = (
            v
            or os.getenv("SUPABASE_KEY")
            or os.getenv("SUPABASE_ANON_KEY")
            or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
            or os.getenv("SUPABASE_PUBLISHABLE_KEY")
            or ""
        ).strip().strip("'\"")
        if not key:
            from dotenv import dotenv_values
            env_vals = dotenv_values(".env") or dotenv_values("backend/.env")
            key = (
                env_vals.get("SUPABASE_KEY")
                or env_vals.get("SUPABASE_ANON_KEY")
                or env_vals.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
                or ""
            ).strip().strip("'\"")
        return key

    @field_validator("SUPABASE_SERVICE_ROLE_KEY", mode="before")
    @classmethod
    def resolve_service_role_key(cls, v: Union[str, None]) -> str:
        key = (
            v
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_SERVICE_KEY")
            or ""
        ).strip().strip("'\"")
        if not key:
            from dotenv import dotenv_values
            env_vals = dotenv_values(".env") or dotenv_values("backend/.env")
            key = (
                env_vals.get("SUPABASE_SERVICE_ROLE_KEY")
                or env_vals.get("SUPABASE_SERVICE_KEY")
                or ""
            ).strip().strip("'\"")
        return key

    # Database: Supabase PostgreSQL only
    DATABASE_URL: str = ""

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def resolve_database_url(cls, v: Union[str, None]) -> str:
        url = (
            v
            or os.getenv("DATABASE_URL")
            or os.getenv("SUPABASE_DB_URL")
            or os.getenv("SUPABASE_DATABASE_URL")
            or os.getenv("POSTGRES_URL")
            or os.getenv("POSTGRESQL_URL")
            or ""
        ).strip()
        if not url:
            # Fall back to checking backend/.env directly if pydantic didn't pick it up
            from dotenv import dotenv_values
            env_vals = dotenv_values(".env") or dotenv_values("backend/.env")
            url = (
                env_vals.get("DATABASE_URL")
                or env_vals.get("SUPABASE_DB_URL")
                or env_vals.get("POSTGRES_URL")
                or ""
            ).strip()
        if url.startswith("sqlite"):
            raise ValueError(
                "SQLite is strictly disabled. Trimz Salon requires the Supabase PostgreSQL database connection URL."
            )
        return url

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
