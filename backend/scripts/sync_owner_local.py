import sqlite3

def sync_owner():
    con = sqlite3.connect("trimz.db")
    cur = con.cursor()
    cur.execute("SELECT id FROM roles WHERE name = 'Owner' LIMIT 1")
    r = cur.fetchone()
    r_id = r[0] if r else None

    cur.execute("""
        INSERT OR REPLACE INTO profiles (id, business_id, email, name, is_owner, status, created_at, updated_at)
        VALUES (
            '6b3b186f-c48f-45ac-ab38-76f98a8931aa',
            '4f234228-8fc9-4096-b2a6-0ec00f8e9eeb',
            'trimzunisexsalonspt@gmail.com',
            'Trimz Main Owner',
            1,
            'ACTIVE',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        )
    """)

    if r_id:
        cur.execute(f"INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES ('6b3b186f-c48f-45ac-ab38-76f98a8931aa', '{r_id}')")

    con.commit()
    con.close()
    print("Owner profile synced into local db successfully!")

if __name__ == "__main__":
    sync_owner()
