from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import settings

import urllib.parse

def normalize_database_url(url: str) -> str:
    """
    Normalizes database connection URLs by safely percent-encoding special characters
    (such as '@', ':', '%') in passwords or usernames that would otherwise break URI parsing.
    """
    if not url:
        return url
        
    url_trimmed = url.strip()
    if url_trimmed.startswith("sqlite"):
        return url_trimmed

    # Handle standard dialect prefix conversions
    if url_trimmed.startswith("postgres://"):
        url_trimmed = "postgresql://" + url_trimmed[len("postgres://"):]

    if "://" not in url_trimmed:
        return url_trimmed

    scheme, rest = url_trimmed.split("://", 1)
    
    # Separate path / query from authority (user:pass@host:port)
    path_start = rest.find("/")
    if path_start != -1:
        authority = rest[:path_start]
        path_and_query = rest[path_start:]
    else:
        authority = rest
        path_and_query = ""

    if "@" not in authority:
        return f"{scheme}://{authority}{path_and_query}"

    # In URI specifications, hostname cannot contain '@'.
    # Therefore, the LAST '@' in the authority component strictly separates userinfo from host[:port].
    userinfo, hostport = authority.rsplit("@", 1)

    if ":" in userinfo:
        user, password = userinfo.split(":", 1)
        quoted_user = urllib.parse.quote(urllib.parse.unquote(user), safe="")
        quoted_password = urllib.parse.quote(urllib.parse.unquote(password), safe="")
        userinfo_clean = f"{quoted_user}:{quoted_password}"
    else:
        userinfo_clean = urllib.parse.quote(urllib.parse.unquote(userinfo), safe="")

    return f"{scheme}://{userinfo_clean}@{hostport}{path_and_query}"

def get_async_db_url(url: str) -> str:
    if not url:
        raise ValueError("DATABASE_URL is not configured. Trimz Salon requires a Supabase PostgreSQL connection URL.")
    if url.strip().startswith("sqlite"):
        raise ValueError("SQLite is disabled. Only Supabase PostgreSQL is supported.")
    normalized = normalize_database_url(url)
    if normalized.startswith("postgres://"):
        return normalized.replace("postgres://", "postgresql+asyncpg://", 1)
    if normalized.startswith("postgresql://") and not any(d in normalized for d in ["+asyncpg", "+psycopg"]):
        return normalized.replace("postgresql://", "postgresql+asyncpg://", 1)
    return normalized

# Engine setup
async_db_url = get_async_db_url(settings.DATABASE_URL)
_is_sqlite = False
connect_args = {
    # Disable prepared statement caching when connected via Supabase transaction pooler (PgBouncer)
    "statement_cache_size": 0,
    "ssl": "require"
}

engine = create_async_engine(
    async_db_url,
    echo=False,
    future=True,
    pool_size=10,
    max_overflow=5,
    pool_recycle=300,
    pool_pre_ping=True,
    connect_args=connect_args
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
