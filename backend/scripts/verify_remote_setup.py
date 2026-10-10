import os
import httpx
from dotenv import load_dotenv

load_dotenv("backend/.env")
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Missing Supabase credentials in backend/.env")
    exit(1)

client = httpx.Client(headers={"apikey": key, "Authorization": f"Bearer {key}"}, timeout=15.0)

tables = ["businesses", "profiles", "roles", "permissions", "user_roles", "services", "audit_logs"]
print("Remote Supabase Live Verification:")
for t in tables:
    res = client.get(f"{url}/rest/v1/{t}?select=id")
    if res.status_code == 200:
        print(f"  [+] Table '{t}': {len(res.json())} records")
    else:
        print(f"  [-] Table '{t}': HTTP {res.status_code} - {res.text}")

prof_res = client.get(f"{url}/rest/v1/profiles?select=id,business_id,email,name,is_owner,status")
if prof_res.status_code == 200:
    print(f"\nProfiles registered ({len(prof_res.json())}):")
    for p in prof_res.json():
        print(f"  - {p.get('email')} | Name: {p.get('name')} | Owner: {p.get('is_owner')} | Status: {p.get('status')}")
