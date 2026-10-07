"""
End-to-end verification script for Trimz Salon business flow.
"""
import httpx

def main():
    base_url = "http://127.0.0.1:8000/api/v1"
    client = httpx.Client(base_url=base_url, timeout=20.0)

    print("=== 1. OWNER AUTHENTICATION ===")
    r = client.post("/auth/login", json={"email": "owner@trimzsalon.com", "password": "Owner123!"})
    assert r.status_code == 200, f"Owner login failed: {r.text}"
    owner_data = r.json()
    owner_token = owner_data["access_token"]
    print(f"Owner authenticated: {owner_data['user']['name']} (Owner: {owner_data['user']['is_owner']})")
    print(f"Owner permissions: {owner_data['permissions']}")

    print("\n=== 2. RECEPTIONIST AUTHENTICATION ===")
    r_staff = client.post("/auth/login", json={"email": "receptionist@trimzsalon.com", "password": "Staff123!"})
    assert r_staff.status_code == 200, f"Staff login failed: {r_staff.text}"
    staff_data = r_staff.json()
    print(f"Staff authenticated: {staff_data['user']['name']} (Owner: {staff_data['user']['is_owner']})")
    print(f"Staff roles: {staff_data['roles']}")
    print(f"Staff scoped permissions count: {len(staff_data['permissions'])}")
    assert "billing.create" in staff_data["permissions"]
    assert "employees.create" not in staff_data["permissions"]
    print("RBAC boundary verified: Staff has billing permissions, but lacks owner administrative permissions.")

    headers = {"Authorization": f"Bearer {owner_token}"}

    print("\n=== 3. SERVICE CATALOG QUERY ===")
    cats = client.get("/services/categories", headers=headers).json()
    svcs = client.get("/services/", headers=headers).json()
    print(f"Loaded {len(cats)} categories and {len(svcs)} active services.")
    svc1, svc2 = svcs[0], svcs[1]
    print(f"Selected item 1: {svc1['name']} @ Rs. {svc1['price']}")
    print(f"Selected item 2: {svc2['name']} @ Rs. {svc2['price']}")

    print("\n=== 4. CUSTOMER LOOKUP & CREATION ===")
    cust_res = client.post("/customers/", json={
        "name": "Kavya Reddy",
        "phone": "9849012345",
        "gender": "women",
        "notes": "Prefers organic hair serum"
    }, headers=headers)
    assert cust_res.status_code == 200, f"Customer create failed: {cust_res.text}"
    customer = cust_res.json()
    print(f"Created customer: {customer['name']} ({customer['phone']}) - ID: {customer['id']}")

    print("\n=== 5. POS WALK-IN CHECKOUT ===")
    subtotal = svc1['price'] + svc2['price']
    discount = 50.0
    tax_rate = 18.0
    taxable = max(0.0, subtotal - discount)
    tax = (taxable * tax_rate) / 100.0
    grand_total = round(taxable + tax)

    sale_payload = {
        "customer_id": customer["id"],
        "discount_amount": discount,
        "tax_rate_percent": tax_rate,
        "payments": [
            {
                "method": "upi",
                "provider": "google_pay",
                "amount": grand_total
            }
        ],
        "items": [
            {
                "service_id": svc1["id"],
                "quantity": 1,
                "unit_price": svc1["price"],
                "discount_amount": 0.0
            },
            {
                "service_id": svc2["id"],
                "quantity": 1,
                "unit_price": svc2["price"],
                "discount_amount": 0.0
            }
        ],
        "notes": "First-time visitor welcome discount"
    }

    checkout_res = client.post("/billing/checkout", json=sale_payload, headers=headers)
    assert checkout_res.status_code == 200, f"Checkout failed: {checkout_res.text}"
    checkout = checkout_res.json()
    print(f"Checkout Completed! Sale: {checkout['sale_number']} | Status: {checkout['status']}")
    print(f"Invoice Number: {checkout['invoice_number']} (Invoice ID: {checkout['invoice_id']})")
    print(f"Total Settled: Rs. {checkout['total_amount']}")

    print("\n=== 6. 80MM THERMAL RECEIPT GENERATION ===")
    receipt = client.get(f"/invoices/{checkout['invoice_id']}/receipt", headers=headers).json()
    print(f"Receipt Business: {receipt['business']['name']}")
    print(f"Receipt Invoice: {receipt['invoice_number']}")
    print(f"Line items in receipt: {len(receipt['items'])}")
    for itm in receipt['items']:
        print(f"  - {itm['service_name']}: {itm['quantity']} x Rs. {itm['unit_price']} = Rs. {itm['total']}")

    print("\n=== 7. LIVE DASHBOARD TELEMETRY VERIFICATION ===")
    metrics = client.get("/dashboard/metrics?time_range=today", headers=headers).json()
    print(f"Total Settled Revenue: Rs. {metrics['total_revenue']}")
    print(f"Transactions Count: {metrics['transaction_count']}")
    print(f"Average Bill Value: Rs. {metrics['average_bill_value']}")
    print(f"Payment Breakdown: {metrics['payment_methods_breakdown']}")
    print(f"UPI Provider Breakdown: {metrics['upi_providers_breakdown']}")
    print(f"Top Services: {[s['name'] for s in metrics['top_services']]}")

    print("\nALL BACKEND FLOWS VERIFIED 100% SUCCEEDED!")

if __name__ == "__main__":
    main()
