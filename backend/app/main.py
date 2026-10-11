from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router
import logging
from sqlalchemy import text
from app.core.database import engine

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Non-destructive startup: verify connection to Supabase PostgreSQL
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Trimz Salon connected to Supabase PostgreSQL database.")
    except Exception as e:
        logger.error("Supabase PostgreSQL connection error: %s", type(e).__name__)
    yield
    # Shutdown logic if any

app = FastAPI(
    title="Trimz Salon Business Platform API",
    description="The canonical backend for Trimz Salon operations, POS billing, customer management, RBAC, and analytics.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.v1.webhooks import router as webhooks_router

# API Routers
app.include_router(api_router, prefix="/api")
app.include_router(webhooks_router, prefix="/api")

@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "Trimz Salon Business Platform API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "api": "/api/v1"
    }

@app.get("/health", tags=["Health"])
@app.get("/api/health", tags=["Health"])
async def health_check():
    return {
        "status": "online",
        "service": "Trimz Salon Platform API",
        "environment": settings.ENVIRONMENT
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)

