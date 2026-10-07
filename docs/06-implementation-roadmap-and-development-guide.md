# Implementation Roadmap & Developer Guide — Trimz Salon

| Document Metadata | Details |
| :--- | :--- |
| **Document Version** | 2.0.0 (Canonical Phased Roadmap) |
| **Status** | Approved Implementation Blueprint |
| **Primary Framework** | FastAPI (Backend) + Next.js (Frontend) + PostgreSQL + Redis |
| **Author** | Lead Software Architect & Technical Program Manager |

---

## 1. Phased Implementation Roadmap

Development must strictly proceed in chronological dependency order. Lower-level foundational and transactional layers must be fully verified before downstream analytics and reporting are constructed.

```mermaid
flowchart TD
    P0[Phase 0: Engineering Foundation\nNext.js + FastAPI + Postgres + Redis] --> P1[Phase 1: Core Domain Entities\nBusiness, Users, Customers, Catalog]
    P1 --> P2[Phase 2: Transactions & Payments\nAtomic Checkout, Price Snapshots, Idempotency]
    P2 --> P3[Phase 3: Invoicing Engine\nDeterministic Numbers & PDF Rendering]
    P3 --> P4[Phase 4: WhatsApp Integration\nPython Worker + Meta Cloud API + Webhooks]
    P4 --> P5[Phase 5: POS Cashier Experience\nFront-Desk Rapid Checkout UI]
    P5 --> P6[Phase 6: Dashboard & Analytics\nTransactional Rollups & Dynamic Aggregations]
    P6 --> P7[Phase 7: Reports & Data Exports\nCSV Streaming & Audit PDF Generation]
    P7 --> P8[Phase 8: Security & Critical Testing\nIdempotency, Isolation & Verification]
    P8 --> P9[Phase 9: Production MVP Release\nDockerization & Live Deployment]
    P9 -.-> P10[Phase 10+: Future Modules\nAppointments, Commissions, Inventory]
```

---

### Detailed Phase Breakdown

#### Phase 0: Repository & Engineering Foundation
- [ ] Initialize repository structure: `frontend/` (Next.js, TypeScript, Tailwind) and `backend/` (FastAPI, Python 3.11+, Poetry/Pipenv).
- [ ] Configure local PostgreSQL 16 and Redis instances via Docker Compose.
- [ ] Establish environment configuration patterns (`.env` with Pydantic Settings).
- [ ] Setup code quality tools (Ruff, Black, ESLint, Prettier).

#### Phase 1: Identity, Business Foundation, Customers & Services
- [ ] Configure Alembic migrations for base schema: `businesses`, `users`, `service_categories`, `services`, `customers`.
- [ ] Implement JWT authentication with role guards (`OWNER` vs `OPERATOR`).
- [ ] Implement Customer Service with normalized E.164 phone indexing and fast autocomplete.
- [ ] Implement Service Catalog CRUD with category associations and active flags.

#### Phase 2: Transactions & Payments (The Core Spine)
- [ ] Implement Atomic Checkout endpoint (`POST /api/v1/sales`) with `Idempotency-Key` enforcement.
- [ ] Enforce price snapshotting in `sale_items`: copy service name, unit price, and discount at time of checkout.
- [ ] Implement payment recording with `payment_method` (`CASH`, `UPI`, `CARD`) and `payment_provider` (`Google Pay`, `PhonePe`, etc.).
- [ ] Maintain customer summary caches transactionally.

#### Phase 3: Invoicing Engine
- [ ] Implement sequential invoice sequence generator (`TRIMZ-YYYYMM-XXXX`).
- [ ] Implement Python PDF invoice rendering (WeasyPrint / ReportLab) for printable 80mm receipts and A4 tax invoices.
- [ ] Connect cloud object storage (Cloudflare R2 / S3) for secure artifact persistence.

#### Phase 4: Asynchronous WhatsApp Cloud API & Webhooks
- [ ] Setup Redis broker and Python background worker (ARQ / RQ).
- [ ] Implement WhatsApp Cloud API client (Meta Graph API v20.0) sending pre-approved utility templates.
- [ ] Implement `/api/webhooks/whatsapp`:
  - `GET`: Hub challenge verification token responder.
  - `POST`: HMAC SHA-256 signature verification and message state tracking (`SENT`, `DELIVERED`, `READ`, `FAILED`).
- [ ] Implement failure isolation: ensure message delivery failures never affect sale or invoice status.
- [ ] Provide dashboard manual "Resend WhatsApp Invoice" action.

#### Phase 5: Point-of-Sale (POS) Operational Experience
- [ ] Build rapid-action walk-in cashier interface in Next.js:
  - Phone number autocomplete banner showing repeat client indicators.
  - Quick-tap service selector with category filtering.
  - Instant line discount and tax computation.
  - Payment selector with one-tap UPI provider selection.
  - Instant UI reset under 400ms after submission.

#### Phase 6: Owner Dashboard & Operational Analytics
- [ ] Implement dynamic SQL aggregation queries reading strictly from completed transactions.
- [ ] Build temporal filtering: Today, Yesterday, This Week, This Month, Last Month, This Year, Custom Range, Lifetime.
- [ ] Build KPI cards (Gross Revenue, ABV, Transactions, Customer Retention).
- [ ] Build visual breakdowns for Payment Methods, UPI Providers, and Top Performing Services.

#### Phase 7: Business Reports & Multi-Format Data Exports
- [ ] Implement parametric report query engine with date range and payment method filters.
- [ ] Build memory-efficient streaming CSV export (`text/csv`) with sanitized spreadsheet formatting.
- [ ] Build executive-ready PDF report generation.

#### Phase 8: Security, Reliability & Critical Testing
- [ ] Execute all critical test suites (see Section 3).
- [ ] Perform security review: rate limiting, CORS, role permission boundaries, and audit logging.
- [ ] Verify zero data drift between transaction ledgers and analytical rollups.

#### Phase 9: Production MVP Release
- [ ] Production Docker containerization for FastAPI, Next.js, and Python Worker.
- [ ] Setup reverse proxy (Caddy/Nginx) with automated SSL/TLS termination.
- [ ] Production smoke testing and handover.

#### Phase 10+: Future Modular Growth (Post-MVP)
- Online Appointment & Slot Booking.
- Stylist Commission Tracking.
- Consumables & Retail Product Inventory.
- Customer Loyalty & Membership Packages.
- Multi-Branch Centralized Administration.
- Exploratory AI/ML Demand Forecasting.

---

## 2. Scope Control Framework

To prevent scope creep, every proposed feature must be evaluated through this formal evaluation framework:

| Evaluation Criterion | Assessment Questions |
| :--- | :--- |
| **1. Business Impact** | Does this materially increase salon revenue or customer retention? |
| **2. Owner Time Saved** | Does this eliminate manual administrative overhead or register tallying? |
| **3. Friction Reduction** | Does this speed up walk-in checkout without adding complexity? |
| **4. Technical Risk** | Does this introduce external dependencies or architectural complexity? |
| **5. MVP Integrity** | Can the salon operate reliably without this feature during launch? |

### Classification Rules:
- **Include in MVP:** Mandatory for core walk-in billing, owner visibility, or WhatsApp invoice delivery.
- **Phase Next (Post-MVP):** High-value operational enhancements with stable dependencies (e.g. Commissions, Appointments).
- **Future Growth:** Complex features requiring historical datasets or advanced tooling (e.g. AI forecasting, Multi-branch).
- **Reject / Defer:** Features that add friction without measurable business ROI.

---

## 3. Mandatory Critical Testing Requirements

Before any production release, the application must pass these non-negotiable verification tests:

| Test Identifier | Category | Verification Scenario & Pass Criteria |
| :--- | :--- | :--- |
| **`TEST-TX-01`** | **Transaction Correctness** | Successful checkout commits `Sale`, `SaleItems`, `Payment`, and `Invoice` atomically. Rolling back one rolls back all. |
| **`TEST-IDEM-02`** | **Duplicate Submission Guard** | Resubmitting an identical checkout payload with the same `Idempotency-Key` returns the existing transaction without creating duplicate records. |
| **`TEST-PRICE-03`** | **Historical Price Snapshotting** | Updating a service price in the catalog from ₹300 to ₹350 leaves all previously generated historical sales and invoices strictly at ₹300. |
| **`TEST-FAIL-04`** | **WhatsApp Failure Isolation** | Simulating a Meta API 500 error or invalid customer phone marks `WhatsAppMessage` as `FAILED`, while leaving `Sale`, `Payment`, and `Invoice` completely successful. |
| **`TEST-HOOK-05`** | **Webhook Security & Idempotency** | Webhooks with missing or invalid HMAC signatures are rejected with HTTP 403. Duplicate webhook events do not duplicate delivery state records. |
| **`TEST-RECON-06`** | **Dashboard Transactional Parity** | The sum of payments from completed sales in a date range matches the Dashboard Gross Revenue figure exactly (0.00 discrepancy). |
| **`TEST-REP-07`** | **Report Parity** | Exported CSV and PDF totals match the Dashboard figures for identical time intervals. |

---

## 4. Environment Configuration Blueprint (`.env.example`)

```bash
# ==============================================================================
# Trimz Salon — Environment Configuration Template
# ==============================================================================

# Core Application
ENVIRONMENT="development"
DEBUG=true
APP_URL="http://localhost:3000"
API_URL="http://localhost:8000"
TIMEZONE="Asia/Kolkata"

# Database Configuration (PostgreSQL 16)
DATABASE_URL="postgresql+asyncpg://postgres:postgres_password@localhost:5432/trimz_salon_db"

# Redis Queue Broker
REDIS_URL="redis://localhost:6379/0"

# Security & Authentication
JWT_SECRET_KEY="generate_a_secure_64_character_random_hex_string"
JWT_ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Object Storage (Cloudflare R2 / AWS S3)
STORAGE_PROVIDER="cloudflare_r2" # 'cloudflare_r2' | 'aws_s3' | 'local'
STORAGE_ACCESS_KEY_ID="your_storage_access_key"
STORAGE_SECRET_ACCESS_KEY="your_storage_secret_key"
STORAGE_BUCKET_NAME="trimz-salon-invoices"
STORAGE_ENDPOINT_URL="https://your_account_id.r2.cloudflarestorage.com"
STORAGE_PUBLIC_DOMAIN="https://invoices.trimzsalon.com"

# Official Meta WhatsApp Cloud API
META_WHATSAPP_API_VERSION="v20.0"
META_WHATSAPP_PHONE_NUMBER_ID="your_meta_phone_number_id"
META_WHATSAPP_BUSINESS_ACCOUNT_ID="your_waba_account_id"
META_WHATSAPP_ACCESS_TOKEN="your_meta_system_user_access_token"
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN="your_custom_webhook_secret_token"
META_WHATSAPP_APP_SECRET="your_meta_app_secret_for_hmac_sha256"
META_WHATSAPP_TEMPLATE_NAME="trimz_invoice_notification"

# Business Information Defaults (Configurable)
DEFAULT_BUSINESS_NAME="Trimz Salon"
DEFAULT_BUSINESS_PHONE="+919800011223"
DEFAULT_TAX_NAME="GST"
DEFAULT_TAX_RATE=0.00
DEFAULT_CURRENCY="INR"
```

---

## 5. Operational Runbooks

### Runbook 1: Voiding a Transaction & Handling Reversals
1. Navigate to the Transaction Ledger in the Owner Portal.
2. Select the target sale and click **"Void Sale"**.
3. Input the required administrative PIN and reason for cancellation.
4. The system updates `Sale` to `CANCELLED`, `Invoice` to `VOID`, records a reversing entry in `payments`, logs an `audit_logs` entry, and immediately updates dashboard revenue totals.

### Runbook 2: Resolving Failed WhatsApp Deliveries
1. Check the WhatsApp Delivery Monitoring tab on the dashboard.
2. Filter by status: `FAILED`.
3. Inspect the error code (e.g., invalid phone format, unverified number).
4. Correct the customer phone number if necessary, and click **"Resend WhatsApp Invoice"**.
5. The system re-enqueues the dispatch job with updated parameters.

---
*End of Implementation Roadmap & Developer Guide.*
