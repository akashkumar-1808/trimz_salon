# API & Integration Specifications — Trimz Salon

| Document Metadata | Details |
| :--- | :--- |
| **Document Version** | 2.0.0 (FastAPI REST Contracts) |
| **Backend Framework** | FastAPI (Python 3.11+) |
| **API Protocol** | RESTful JSON over HTTPS (TLS 1.3) |
| **Author** | Lead Software Architect & Backend Engineering Team |

---

## 1. Global Conventions & Standards

### 1.1 Base URLs & Versioning
- Application Core Endpoints: `/api/v1/...`
- External Webhook Ingestion: `/api/webhooks/...`
- Public Storefront Endpoints: `/api/public/...`

### 1.2 Authentication & Headers
Protected operational endpoints require an authenticated JWT Bearer token:
```http
Authorization: Bearer <jwt_access_token>
Content-Type: application/json
Accept: application/json
```

For mutating billing transactions, clients must include an `Idempotency-Key`:
```http
Idempotency-Key: a4f1d07c-9b88-4663-88fe-d54b1f6305a2
```

### 1.3 Standard Error Envelope
All error responses adhere to a consistent JSON format:
```json
{
  "success": false,
  "error": {
    "code": "CUSTOMER_NOT_FOUND",
    "message": "No customer was found with the provided phone number.",
    "details": {
      "phone": "+919876543210"
    },
    "timestamp": "2026-10-07T14:30:00Z"
  }
}
```

---

## 2. Authentication & Authorization Endpoints

### 2.1 Staff Login (`POST /api/v1/auth/login`)
Authenticates salon owner or receptionist operator.

**Request Body:**
```json
{
  "email": "owner@trimzsalon.com",
  "password": "SecurePassword123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "c1f7a4d2-28e6-4299-a417-6d2678822001",
      "name": "Salon Administrator",
      "role": "OWNER",
      "businessId": "b001a111-1111-4111-8111-111111111111",
      "businessName": "Trimz Salon"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2026-10-08T14:30:00Z"
  }
}
```

---

## 3. Requirement 1: Dashboard & Analytics Endpoints

### 3.1 Business Analytics Overview (`GET /api/v1/analytics/overview`)
Aggregates operational metrics directly from completed transactions.

**Query Parameters:**
- `range`: `today` | `yesterday` | `this_week` | `this_month` | `last_month` | `this_year` | `custom` | `lifetime`
- `startDate`: ISO 8601 Date string (e.g., `2026-10-01`)
- `endDate`: ISO 8601 Date string (e.g., `2026-10-07`)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "period": {
      "range": "this_week",
      "start": "2026-10-05T00:00:00+05:30",
      "end": "2026-10-07T19:30:00+05:30"
    },
    "kpis": {
      "grossRevenue": 48750.00,
      "totalTransactions": 65,
      "averageBillValue": 750.00,
      "totalCustomersServed": 61,
      "newCustomers": 22,
      "returningCustomers": 39
    },
    "paymentBreakdown": {
      "byMethod": [
        { "method": "UPI", "amount": 35200.00, "count": 47, "sharePercent": 72.2 },
        { "method": "CASH", "amount": 11550.00, "count": 16, "sharePercent": 23.7 },
        { "method": "CARD", "amount": 2000.00, "count": 2, "sharePercent": 4.1 }
      ],
      "upiByProvider": [
        { "provider": "Google Pay", "amount": 19500.00, "count": 26 },
        { "provider": "PhonePe", "amount": 12700.00, "count": 17 },
        { "provider": "Paytm", "amount": 3000.00, "count": 4 }
      ]
    },
    "topServices": [
      { "serviceId": "srv-101", "name": "Haircut & Styling", "unitsSold": 42, "totalRevenue": 18900.00 },
      { "serviceId": "srv-104", "name": "Beard Sculpt", "unitsSold": 31, "totalRevenue": 9300.00 }
    ]
  }
}
```

---

## 4. Customer Management Endpoints

### 4.1 Fast Customer Lookup (`GET /api/v1/customers/search`)
Used by the cashier autocomplete during walk-in checkout.

**Query Parameters:**
- `query`: Phone number digits or partial name (e.g., `9876543210`).

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "cust-8821",
      "name": "Customer Profile",
      "phone": "+919876543210",
      "totalVisits": 6,
      "totalSpend": 4200.00,
      "lastVisitAt": "2026-09-18T16:45:00+05:30"
    }
  ]
}
```

---

## 5. Requirement 2: Billing & Checkout Endpoints

### 5.1 Create Transaction & Generate Invoice (`POST /api/v1/sales`)
Atomically commits customer profile, sale items with historical price snapshots, payment record, generates invoice sequence number, and queues background WhatsApp delivery.

**Headers:**
```http
Authorization: Bearer <token>
Idempotency-Key: a1b2c3d4-e5f6-7890-abcd-1234567890ab
Content-Type: application/json
```

**Request Body:**
```json
{
  "customer": {
    "phone": "+919876543210",
    "name": "Customer Name",
    "email": "customer@example.com"
  },
  "items": [
    {
      "serviceId": "srv-101",
      "quantity": 1,
      "discountAmount": 0.00
    },
    {
      "serviceId": "srv-104",
      "quantity": 1,
      "discountAmount": 50.00
    }
  ],
  "overallDiscount": 0.00,
  "discountReason": null,
  "taxPercentage": 0.00,
  "payment": {
    "amount": 750.00,
    "method": "UPI",
    "provider": "PhonePe",
    "transactionReference": "UPI/428910293120/PPe"
  },
  "sendWhatsAppInvoice": true,
  "notes": "Regular visit"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "saleId": "sale-99182",
    "saleNumber": "TRIMZ-SALE-0042",
    "status": "COMPLETED",
    "invoice": {
      "id": "inv-5512",
      "invoiceNumber": "TRIMZ-202610-0042",
      "status": "ISSUED",
      "subtotal": 800.00,
      "discountAmount": 50.00,
      "taxAmount": 0.00,
      "totalAmount": 750.00,
      "printableReceiptUrl": "/api/v1/invoices/inv-5512/print"
    },
    "whatsappDelivery": {
      "status": "QUEUED",
      "recipientPhone": "+919876543210"
    }
  }
}
```

---

## 6. WhatsApp Cloud API Webhook Integration

### 6.1 Meta Webhook Verification (`GET /api/webhooks/whatsapp`)
Validates endpoint during Meta App configuration.

**Query Parameters:**
- `hub.mode`: `subscribe`
- `hub.challenge`: Random challenge string.
- `hub.verify_token`: Custom secret verification token.

**Response:**
Returns raw text of `hub.challenge` with HTTP 200.

---

### 6.2 Meta Status Update Ingestion (`POST /api/webhooks/whatsapp`)
Receives real-time asynchronous delivery events from Meta servers.

**Headers:**
```http
X-Hub-Signature-256: sha256=d5b98a3b5c8f...
Content-Type: application/json
```

**Incoming Meta Payload:**
```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "104928172918239",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "statuses": [
              {
                "id": "wamid.HBgMOTE5ODc2NTQzMjEwFQIAERgSMzEyOTg3MTI...",
                "status": "delivered",
                "timestamp": "1728289450",
                "recipient_id": "919876543210"
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

**Processing Logic:**
1. Validates `X-Hub-Signature-256` HMAC.
2. Extracts status (`delivered`, `read`, `failed`).
3. Updates `whatsapp_messages` row where `meta_message_id = id`.
4. Responds immediately with HTTP 200 OK.

---

## 7. Requirement 3: Reports & Data Export Endpoints

### 7.1 Export Sales Ledger (`GET /api/v1/reports/sales/export`)
Streams formatted reports in CSV or PDF format for financial audits.

**Query Parameters:**
- `format`: `csv` | `pdf`
- `startDate`: `2026-10-01`
- `endDate`: `2026-10-07`
- `paymentMethod`: `ALL` | `CASH` | `UPI` | `CARD`

**CSV Response Sample (`format=csv`):**
```csv
Invoice Number,Date,Time,Customer Name,Phone,Services,Subtotal,Discount,Tax,Total,Payment Method,Provider,Reference
TRIMZ-202610-0040,2026-10-07,11:15:22,Client A,+919811223344,Haircut,350.00,0.00,0.00,350.00,CASH,,
TRIMZ-202610-0041,2026-10-07,12:04:10,Client B,+919822334455,Beard Trim,150.00,0.00,0.00,150.00,UPI,Google Pay,UPI/428910001
TRIMZ-202610-0042,2026-10-07,13:30:45,Client C,+919876543210,"Haircut, Beard Trim",800.00,50.00,0.00,750.00,UPI,PhonePe,UPI/428910293
```

---
*End of API & Integration Specifications.*
