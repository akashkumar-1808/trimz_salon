from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router
from app.db.init_db import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure database tables & initial seeds exist
    try:
        await init_db()
        print("Trimz Salon database initialized.")
    except Exception as e:
        print(f"Warning: DB initialization error: {e}")
    yield
    # Shutdown logic if any

app = FastAPI(
    title="Trimz Salon Business Platform API",
    description="The canonical backend for Trimz Salon operations, POS billing, customer management, RBAC, and analytics.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from app.api.v1.webhooks import router as webhooks_router

# API Routers
app.include_router(api_router, prefix="/api")
app.include_router(webhooks_router, prefix="/api")

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
