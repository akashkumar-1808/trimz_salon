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

    # CORS
    CORS_ORIGINS: Union[str, List[str]] = "http://localhost:3000,http://127.0.0.1:3000"

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
