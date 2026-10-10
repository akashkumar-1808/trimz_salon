import sqlite3

conn = sqlite3.connect('trimz.db')
c = conn.cursor()

c.execute('PRAGMA table_info(invoices)')
cols = [r[1] for r in c.fetchall()]

if 'image_url' not in cols:
    c.execute('ALTER TABLE invoices ADD COLUMN image_url TEXT')
    print('Added image_url to invoices')
if 'render_status' not in cols:
    c.execute("ALTER TABLE invoices ADD COLUMN render_status VARCHAR(20) DEFAULT 'PENDING'")
    print('Added render_status to invoices')
if 'rendered_at' not in cols:
    c.execute('ALTER TABLE invoices ADD COLUMN rendered_at TIMESTAMP')
    print('Added rendered_at to invoices')

c.execute('''
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    invoice_id TEXT NOT NULL,
    customer_id TEXT,
    recipient_phone VARCHAR(30) NOT NULL,
    meta_message_id VARCHAR(150) UNIQUE,
    media_id VARCHAR(150),
    caption TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
''')
print('Created whatsapp_messages table')

conn.commit()
conn.close()
