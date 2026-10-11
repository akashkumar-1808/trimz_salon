from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.employees import router as employees_router
from app.api.v1.roles import router as roles_router
from app.api.v1.customers import router as customers_router
from app.api.v1.services import router as services_router
from app.api.v1.billing import router as billing_router
from app.api.v1.invoices import router as invoices_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.audit import router as audit_router
from app.api.v1.settings import router as settings_router
from app.api.v1.reports import router as reports_router
from app.api.v1.webhooks import router as webhooks_router
from app.api.v1.public import router as public_router

api_router = APIRouter(prefix="/v1")

api_router.include_router(auth_router)
api_router.include_router(employees_router)
api_router.include_router(roles_router)
api_router.include_router(customers_router)
api_router.include_router(services_router)
api_router.include_router(billing_router)
api_router.include_router(invoices_router)
api_router.include_router(dashboard_router)
api_router.include_router(audit_router)
api_router.include_router(settings_router)
api_router.include_router(reports_router)
api_router.include_router(webhooks_router)
api_router.include_router(public_router, prefix="/public")

