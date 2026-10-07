# Software Requirements Specification (SRS) — Trimz Salon

| Document Metadata | Details |
| :--- | :--- |
| **Product Name** | Trimz Salon |
| **Document Version** | 1.0.0 (Canonical Specification) |
| **Document Status** | Approved Baseline Specification |
| **Author** | Lead Software Architect & Systems Analyst |

---

## 1. Introduction & Purpose

This Software Requirements Specification (SRS) formalizes the technical and functional constraints for **Trimz Salon**. It provides an unambiguous contract between product requirements and engineering implementation.

---

## 2. Requirement Traceability Matrix

Every business requirement defined in the Product Requirements Document maps directly to specific functional specifications, architectural modules, database entities, APIs, and implementation phases:

| Business Requirement | SRS Requirement ID | Architectural Component | Database Entity | API Endpoint | Implementation Phase |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Req 1: Dashboard & Analytics** | `FR-DASH-01` to `FR-DASH-06` | FastAPI Analytics Service | `sales`, `payments`, `sale_items`, `services` | `GET /api/v1/analytics/overview` | Phase 6 |
| **Req 2: Customer Lookup/Create** | `FR-CUST-01` to `FR-CUST-03` | FastAPI Customer Service | `customers` | `GET /api/v1/customers/search`<br/>`POST /api/v1/customers` | Phase 1 & 2 |
| **Req 2: Service Selection & Cart** | `FR-CAT-01` to `FR-CAT-03` | FastAPI Catalog Service | `services`, `service_categories` | `GET /api/v1/services` | Phase 1 & 2 |
| **Req 2: Transaction & Payment** | `FR-BILL-01` to `FR-BILL-05` | FastAPI Billing Engine | `sales`, `sale_items`, `payments` | `POST /api/v1/sales` | Phase 2 |
| **Req 2: Invoice Generation** | `FR-INV-01` to `FR-INV-04` | FastAPI Invoicing Service + PDF Generator | `invoices` | `GET /api/v1/invoices/{id}/pdf`<br/>`GET /api/v1/invoices/{id}/print` | Phase 3 |
| **Req 2: WhatsApp Cloud Delivery** | `FR-WA-01` to `FR-WA-06` | Redis + Python Worker + Webhook Handler | `whatsapp_messages` | `POST /api/v1/invoices/{id}/resend-whatsapp`<br/>`POST /api/webhooks/whatsapp` | Phase 4 |
| **Req 3: Business Reports & Exports** | `FR-REP-01` to `FR-REP-05` | FastAPI Reporting Engine | `sales`, `payments`, `sale_items`, `customers` | `GET /api/v1/reports/sales/export` | Phase 7 |

---

## 3. Functional Requirements

### 3.1 Customer Management

- **`FR-CUST-01` (Phone Indexing & Normalization):**
  - Customer phone numbers must be normalized to E.164 format (e.g., `+91XXXXXXXXXX`).
  - Lookup queries must execute against an indexed B-Tree field.
- **`FR-CUST-02` (Duplicate Prevention):**
  - The database must enforce uniqueness on `(business_id, phone)`. No duplicate customer profiles may exist within a business scope.
- **`FR-CUST-03` (Transaction Summary Caching):**
  - Customer records may maintain cached counters (`total_visits`, `total_spend`, `last_visit_at`) strictly for fast cashier autocomplete display.
  - These values must be maintained via transactional updates and verifiable against historical sales.

### 3.2 Service Catalog & Pricing

- **`FR-CAT-01` (Service Organization):**
  - Services must belong to categories and have configurable duration, price, and active status.
- **`FR-CAT-02` (Historical Price Snapshotting):**
  - When a transaction is committed, the exact service name and unit price at the time of the sale must be permanently snapshotted into `sale_items`.
  - Future price adjustments in the catalog must never alter historical sale records or historical invoices.

### 3.3 Billing & Point-of-Sale Checkout

- **`FR-BILL-01` (Cart Calculation Engine):**
  - System must compute line totals: $(\text{Unit Price} \times \text{Quantity}) - \text{Line Discount}$.
  - System must apply tax rates based on business configuration.
  - Net payable amount must equal: $\text{Subtotal} - \text{Overall Discount} + \text{Tax Amount}$.
- **`FR-BILL-02` (Idempotency Protection):**
  - The checkout endpoint must accept a unique `Idempotency-Key` header.
  - Resubmission of the same key within 24 hours must return the existing transaction response without creating duplicate records.
- **`FR-BILL-03` (Atomic Transaction Boundary):**
  - Customer upsert, Sale insertion, SaleItem snapshots, Payment creation, and Invoice generation must execute inside a single atomic database transaction (`BEGIN ... COMMIT`).
  - If any component fails, the database must roll back completely.
- **`FR-BILL-04` (Payment Classification):**
  - Payments must record `payment_method` (`CASH`, `UPI`, `CARD`, `OTHER`).
  - For `UPI`, an optional `payment_provider` (`Google Pay`, `PhonePe`, `Paytm`, `Other`) must be supported.
- **`FR-BILL-05` (Financial State Separation):**
  - `Sale` states (`DRAFT`, `COMPLETED`, `CANCELLED`, `REFUNDED`) must remain distinct from `Payment` states (`PENDING`, `SUCCESS`, `FAILED`, `REFUNDED`).

### 3.4 Invoicing & Document Artifacts

- **`FR-INV-01` (Deterministic Invoice Numbering):**
  - Invoices must receive sequential, formatted numbers: `TRIMZ-YYYYMM-XXXX`.
- **`FR-INV-02` (Data Immutability):**
  - An invoice with state `ISSUED` cannot have line items or monetary amounts modified.
  - Cancellations must transition invoice state to `VOID` and generate an audit log entry.
- **`FR-INV-03` (Multi-Format Rendering):**
  - Invoices must be printable in standard browser formats (80mm thermal receipt or A4/A5) and exportable as high-fidelity PDF documents.

### 3.5 Asynchronous WhatsApp Cloud API Delivery

- **`FR-WA-01` (Non-Blocking Dispatch):**
  - The POS checkout flow must enqueue WhatsApp dispatch tasks to Redis and return success to the cashier immediately.
  - Checkout response latency must not depend on Meta API responsiveness.
- **`FR-WA-02` (Failure Isolation):**
  - If WhatsApp message delivery fails, the underlying completed `Sale`, `Payment`, and `Invoice` must remain completely valid and intact.
- **`FR-WA-03` (Official Meta Cloud API):**
  - Outbound messaging must strictly use official Meta WhatsApp Cloud API pre-approved templates.
- **`FR-WA-04` (Webhook Delivery Tracking):**
  - Inbound status webhooks from Meta must transition message records through: `QUEUED` $\rightarrow$ `SENDING` $\rightarrow$ `SENT` $\rightarrow$ `DELIVERED` $\rightarrow$ `READ` (or `FAILED`).
- **`FR-WA-05` (Webhook Security & Idempotency):**
  - The webhook endpoint must verify `hub.verify_token` during configuration.
  - All status payload events must validate Meta's HMAC SHA-256 signature (`X-Hub-Signature-256`).
  - Duplicate webhook events must be ignored idempotently using Meta's `wamid`.
- **`FR-WA-06` (Manual Resend Capability):**
  - Cashiers and owners must have a "Resend WhatsApp Invoice" action in the dashboard to re-trigger failed message jobs.

### 3.6 Owner Dashboard & Analytics

- **`FR-DASH-01` (Dynamic Derivation from Transactional Truth):**
  - All revenue, transaction count, average bill value, and customer metrics must be derived directly from transactional data.
  - Independent manual counter databases are strictly prohibited.
- **`FR-DASH-02` (Time Horizon Filtering):**
  - Must support: Today, Yesterday, This Week, This Month, Last Month, This Year, Custom Date Range, and Lifetime.
- **`FR-DASH-03` (Payment & Provider Breakdown):**
  - Aggregations must present totals by payment method and sub-totals by UPI provider.
- **`FR-DASH-04` (Service Performance Ranking):**
  - Must rank services by total units sold and revenue contribution.

### 3.7 Business Reports & Data Export

- **`FR-REP-01` (Parametric Filtering):**
  - Reports must support filtering by date ranges and payment methods.
- **`FR-REP-02` (Dual Export Format):**
  - Must provide formatted **PDF** documents for printing/audits and structured **CSV** streams for Excel and accounting spreadsheets.
- **`FR-REP-03` (Single Source of Truth):**
  - Report calculations must match dashboard figures exactly for identical timeframes.

---

## 4. Non-Functional Requirements (NFRs)

### 4.1 Performance Requirements
- **`NFR-PERF-01` (POS Response Time):** Complete sale creation API call must respond in $< 400\text{ms}$ under standard network conditions.
- **`NFR-PERF-02` (Dashboard Rendering):** Aggregated metrics for periods up to 12 months must return in $< 800\text{ms}$.
- **`NFR-PERF-03` (Streaming Exports):** CSV reports must use cursor streaming to maintain memory consumption under $20\text{MB}$ regardless of dataset size.

### 4.2 Security Requirements
- **`NFR-SEC-01` (Authentication & RBAC):** Strict role enforcement between `OWNER` (full financial visibility) and `OPERATOR` (POS billing and customer operations only).
- **`NFR-SEC-02` (Secrets Hygiene):** Zero hardcoded credentials or API tokens in source code or documentation. All secrets supplied via environment variables.
- **`NFR-SEC-03` (Transport Security):** Enforce HTTPS / TLS 1.3 for all production API and webhook interactions.
- **`NFR-SEC-04` (Audit Logging):** All sale cancellations, manual discounts, and invoice voids must be recorded with operator ID, timestamp, and justification.

### 4.3 Reliability & Availability
- **`NFR-REL-01` (Zero Double Billing):** Enforce strict database idempotency constraints on checkout submissions.
- **`NFR-REL-02` (Worker Retry Resilience):** Transient external network errors in WhatsApp dispatch must retry with exponential backoff (up to 3 attempts).

### 4.4 Configurable Business Profile
- **`NFR-COMP-01` (Tax & Business Agnosticism):** System must not hardcode tax rates or tax registration labels. Values such as tax name, tax rate percentage, currency symbol, and timezone must be configurable in the business profile.

---
*End of Software Requirements Specification.*
