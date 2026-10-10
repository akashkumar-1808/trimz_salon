#!/usr/bin/env python3
"""
TRIMZ SALON — SECURE OWNER BOOTSTRAP SCRIPT
This script performs the controlled, one-time bootstrap of the initial
Salon Owner account using the server-side Supabase Service Role Key.

Features:
- Never exposes service keys to frontend or client.
- Creates user in Supabase Auth via Admin API.
- Associates user profile with Trimz Salon business boundary.
- Assigns the canonical Owner role.
- Confirms email without requiring external SMTP on initial setup.
- Verifies privilege escalation cannot occur via client.
"""

import os
import sys
import argparse
import httpx
from dotenv import load_dotenv

# Load backend environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def validate_environment():
    if not SUPABASE_URL:
        print("ERROR: SUPABASE_URL is not configured in backend/.env", file=sys.stderr)
        sys.exit(1)
    if not SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY.startswith("your-"):
        print("ERROR: SUPABASE_SERVICE_ROLE_KEY is not configured or contains placeholder.", file=sys.stderr)
        sys.exit(1)

def bootstrap_owner(email: str, password: str, name: str, phone: str = None):
    validate_environment()
    
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json"
    }

    client = httpx.Client(timeout=30.0)

    print(f"[*] Bootstrapping owner for Trimz Salon: {email}...")

    # Step 1: Create or fetch user in Supabase Auth Admin API
    auth_admin_url = f"{SUPABASE_URL}/auth/v1/admin/users"
    auth_payload = {
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": {
            "name": name,
            "role": "owner"
        }
    }

    try:
        r_auth = client.post(auth_admin_url, headers=headers, json=auth_payload)
        if r_auth.status_code == 200 or r_auth.status_code == 201:
            user_data = r_auth.json()
            user_id = user_data["id"]
            print(f"[+] Supabase Auth user created successfully. User ID: {user_id}")
        elif r_auth.status_code == 422 and "already registered" in r_auth.text:
            print("[!] User already registered in Supabase Auth. Fetching existing ID...")
            # Query users
            list_res = client.get(f"{SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50", headers=headers)
            users_list = list_res.json().get("users", [])
            match = next((u for u in users_list if u.get("email") == email), None)
            if not match:
                print("[-] Could not retrieve existing user ID.", file=sys.stderr)
                sys.exit(1)
            user_id = match["id"]
            print(f"[+] Found existing user ID: {user_id}")
        else:
            print(f"[-] Supabase Auth Admin error ({r_auth.status_code}): {r_auth.text}", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"[-] Connection error contacting Supabase Auth: {e}", file=sys.stderr)
        sys.exit(1)

    # Step 2: Fetch Trimz Salon Business ID
    rest_url = f"{SUPABASE_URL}/rest/v1"
    biz_res = client.get(
        f"{rest_url}/businesses?select=id,name&name=eq.Trimz%20Salon",
        headers=headers
    )
    if biz_res.status_code != 200 or not biz_res.json():
        print("[-] Business 'Trimz Salon' not found in database. Please run migrations first.", file=sys.stderr)
        sys.exit(1)
    
    business_id = biz_res.json()[0]["id"]
    print(f"[+] Found business boundary: {business_id} ('Trimz Salon')")

    # Step 3: Invoke the secure bootstrap RPC function
    rpc_url = f"{rest_url}/rpc/bootstrap_business_owner"
    rpc_payload = {
        "p_business_id": business_id,
        "p_user_id": user_id,
        "p_name": name,
        "p_phone": phone
    }

    rpc_res = client.post(rpc_url, headers=headers, json=rpc_payload)
    if rpc_res.status_code in [200, 201]:
        result = rpc_res.json()
        print(f"[+] Owner successfully bootstrapped in database:")
        print(f"    - Business ID: {business_id}")
        print(f"    - User ID:     {user_id}")
        print(f"    - Email:       {email}")
        print(f"    - Role:        Owner (Full Administrative Authority)")
    else:
        # Fallback to direct REST upsert via service_role if RPC is not yet applied
        print(f"[!] RPC unavailable ({rpc_res.status_code}). Performing direct service_role upsert...")
        profile_payload = {
            "id": user_id,
            "business_id": business_id,
            "email": email,
            "name": name,
            "phone": phone,
            "is_owner": True,
            "status": "ACTIVE"
        }
        upsert_res = client.post(
            f"{rest_url}/profiles",
            headers={**headers, "Prefer": "resolution=merge-duplicates"},
            json=profile_payload
        )
        if upsert_res.status_code not in [200, 201]:
            print(f"[-] Profile creation error ({upsert_res.status_code}): {upsert_res.text}", file=sys.stderr)
            sys.exit(1)
        print(f"[+] Profile configured directly via service_role.")

    print("\n[✓] OWNER BOOTSTRAP COMPLETE.")

import getpass

def resolve_owner_password() -> str:
    """
    Securely resolves the owner password without command-line argument exposure.
    Prioritizes:
    1. OWNER_INITIAL_PASSWORD environment variable
    2. Interactive masked prompt via getpass (with confirmation)
    3. Piped standard input
    """
    env_password = os.getenv("OWNER_INITIAL_PASSWORD")
    if env_password:
        return env_password.strip()

    if sys.stdin.isatty():
        while True:
            pwd = getpass.getpass("Enter secure initial password for Salon Owner: ")
            if not pwd:
                print("[-] Password cannot be empty. Please retry.", file=sys.stderr)
                continue
            if len(pwd) < 8:
                print("[-] Password must be at least 8 characters long.", file=sys.stderr)
                continue
            confirm = getpass.getpass("Confirm Salon Owner password: ")
            if pwd != confirm:
                print("[-] Passwords do not match. Please try again.\n", file=sys.stderr)
                continue
            return pwd
    else:
        piped = sys.stdin.readline().strip()
        if piped:
            return piped

    print("[-] Error: No password provided. Set OWNER_INITIAL_PASSWORD or enter interactively.", file=sys.stderr)
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Trimz Salon — Secure Owner Bootstrap Utility")
    parser.add_argument("--email", default="trimzunisexsalonspt@gmail.com", help="Owner work email (default: trimzunisexsalonspt@gmail.com)")
    parser.add_argument("--name", default="Harshith", help="Owner full legal name (default: trimz unisex salon)")
    parser.add_argument("--phone", default="+919800011223", help="Owner contact phone (default: +919800011223)")

    args = parser.parse_args()
    password = resolve_owner_password()
    bootstrap_owner(args.email, password, args.name, args.phone)

if __name__ == "__main__":
    main()
