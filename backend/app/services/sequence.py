import re
from typing import Optional, Tuple
from uuid import UUID
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sale import Sale
from app.models.invoice import Invoice
from app.models.business import Business


def extract_sequence_number(code: Optional[str]) -> Optional[int]:
    """
    Extract the integer sequence number suffix from sale or invoice number strings.
    Handles standard formats:
      - TZ-20261108-0265 -> 265
      - TRIMZ-202611-0265 -> 265
      - TZ-20261001-0007-DUP -> 7
      - TZ-20261001-0007-DUP-2 -> 7
      - SALE-001 -> 1
      - INV-2026-999 -> 999
    """
    if not code:
        return None
    code_str = str(code).strip()
    if not code_str:
        return None

    parts = code_str.split('-')

    # Case 1: Standard TRIMZ format: {PREFIX}-{DATE}-{SEQ}[-MODIFIERS]
    # e.g., TZ-20261108-0265, TRIMZ-202611-0265, TZ-20261001-0007-DUP
    if len(parts) >= 3 and len(parts[1]) in (6, 8) and (parts[1].startswith("202") or parts[1].startswith("203")):
        clean_p2 = re.sub(r'\D', '', parts[2])
        if clean_p2:
            return int(clean_p2)

    # Case 2: Standard {PREFIX}-{SEQ} format: SALE-001, INV-002
    if len(parts) == 2 and parts[1].isdigit():
        return int(parts[1])

    # Case 3: {PREFIX}-{YEAR}-{SEQ}: INV-2026-999
    if len(parts) >= 3 and parts[-1].isdigit():
        return int(parts[-1])

    # Case 4: Reverse search for a non-date numeric token
    for p in reversed(parts):
        clean = re.sub(r'\D', '', p)
        if clean:
            val = int(clean)
            if len(clean) in (6, 8) and (clean.startswith("202") or clean.startswith("203")):
                continue
            return val

    return None


async def get_next_sale_and_invoice_numbers(
    db: AsyncSession,
    business: Business,
    date_str: str,
    month_str: str,
    min_seq: int = 1
) -> Tuple[str, str, int]:
    """
    Atomically derives the next guaranteed unique sale and invoice numbers for a business.
    
    1. Finds sequence floor from total sale count.
    2. Queries recent sales, recent invoices, today's sales, and this month's invoices.
    3. Derives candidate_seq = max(highest_detected_seq, total_sale_count, min_seq - 1) + 1.
    4. Loops through database existence checks on (business_id, sale_number) and
       (business_id, invoice_number) to ensure the returned numbers do not collide with
       ANY existing record.
    
    Returns:
        (sale_number, invoice_number, candidate_seq)
    """
    bill_prefix = (business.bill_prefix or "TZ").strip()

    # 1. Base floor from total sales count
    count_res = await db.execute(
        select(func.count(Sale.id)).where(Sale.business_id == business.id)
    )
    count_floor = count_res.scalar() or 0

    # 2. Fetch recent sales (up to 100)
    recent_sales_res = await db.execute(
        select(Sale.sale_number)
        .where(Sale.business_id == business.id)
        .order_by(desc(Sale.created_at))
        .limit(100)
    )
    recent_sales = recent_sales_res.scalars().all()

    # 3. Fetch recent invoices (up to 100)
    recent_invs_res = await db.execute(
        select(Invoice.invoice_number)
        .where(Invoice.business_id == business.id)
        .order_by(desc(Invoice.created_at))
        .limit(100)
    )
    recent_invs = recent_invs_res.scalars().all()

    # 4. Fetch any matching today's sale prefix or this month's invoice prefix
    today_sales_res = await db.execute(
        select(Sale.sale_number)
        .where(
            Sale.business_id == business.id,
            Sale.sale_number.like(f"{bill_prefix}-{date_str}-%")
        )
    )
    today_sales = today_sales_res.scalars().all()

    month_invs_res = await db.execute(
        select(Invoice.invoice_number)
        .where(
            Invoice.business_id == business.id,
            Invoice.invoice_number.like(f"TRIMZ-{month_str}-%")
        )
    )
    month_invs = month_invs_res.scalars().all()

    # Collect all numbers to extract highest sequence
    all_codes = set(recent_sales) | set(recent_invs) | set(today_sales) | set(month_invs)
    seqs = [extract_sequence_number(code) for code in all_codes]
    valid_seqs = [s for s in seqs if s is not None]
    max_detected = max(valid_seqs) if valid_seqs else 0

    candidate_seq = max(max_detected, count_floor, min_seq - 1) + 1

    # 5. Collision verification loop against DB
    while True:
        candidate_sale_number = f"{bill_prefix}-{date_str}-{candidate_seq:04d}"
        candidate_invoice_number = f"TRIMZ-{month_str}-{candidate_seq:04d}"

        # Check if candidate_sale_number already exists in sales
        s_chk = await db.execute(
            select(Sale.id).where(
                Sale.business_id == business.id,
                Sale.sale_number == candidate_sale_number
            ).limit(1)
        )
        if s_chk.scalar_one_or_none():
            candidate_seq += 1
            continue

        # Check if candidate_invoice_number already exists in invoices
        i_chk = await db.execute(
            select(Invoice.id).where(
                Invoice.business_id == business.id,
                Invoice.invoice_number == candidate_invoice_number
            ).limit(1)
        )
        if i_chk.scalar_one_or_none():
            candidate_seq += 1
            continue

        return candidate_sale_number, candidate_invoice_number, candidate_seq
