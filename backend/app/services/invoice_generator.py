import os
import html
from pathlib import Path
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from typing import Optional, List, Dict, Any
from PIL import Image, ImageDraw, ImageFont

ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
TEMPLATE_PATH = ASSETS_DIR / "invoice_template.png"
if not TEMPLATE_PATH.exists():
    FRONTEND_PUBLIC = Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "public" / "invoice.png"
    if FRONTEND_PUBLIC.exists():
        TEMPLATE_PATH = FRONTEND_PUBLIC

def _get_font(font_name: str, size: int) -> ImageFont.ImageFont:
    for name in [font_name, "segoeuib.ttf", "arialbd.ttf", "segoeui.ttf", "arial.ttf"]:
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            continue
    return ImageFont.load_default()

def generate_invoice_png(
    invoice_number: str,
    created_at: datetime,
    customer_name: str,
    customer_phone: str,
    items: List[Dict[str, Any]],
    subtotal: float,
    discount_amount: float,
    tax_amount: float,
    total_amount: float,
    payment_method: str = "UPI",
    payment_provider: Optional[str] = None,
    transaction_reference: Optional[str] = None,
    stylist_name: Optional[str] = None,
    output_path: Optional[str] = None,
    time_zone: str = "Asia/Kolkata"
) -> str:
    """
    Renders high-resolution customer invoice PNG based on the official Trimz Unisex Salon template.
    Pixel coordinates are mapped to match the printed template underlines and boxes.
    """
    if not TEMPLATE_PATH.exists():
        raise FileNotFoundError(f"Invoice template not found at {TEMPLATE_PATH}")

    # 1. Open original template (1024 x 1536)
    base_img = Image.open(TEMPLATE_PATH).convert("RGB")
    draw = ImageDraw.Draw(base_img)

    # 2. Fonts
    font_bold = _get_font("segoeuib.ttf", 17)
    font_regular = _get_font("segoeui.ttf", 16)
    font_item_name = _get_font("segoeuib.ttf", 15)
    font_item_detail = _get_font("segoeui.ttf", 13)
    font_small = _get_font("segoeui.ttf", 14)
    font_small_bold = _get_font("segoeuib.ttf", 15)
    font_total_white = _get_font("segoeuib.ttf", 22)

    # Colors
    c_black = (24, 24, 27)
    c_gray = (82, 82, 91)
    c_white = (255, 255, 255)
    c_green = (22, 101, 52)

    # Convert timestamp to business timezone
    try:
        tz = ZoneInfo(time_zone)
        dt_local = created_at.astimezone(tz) if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc).astimezone(tz)
    except Exception:
        dt_local = created_at

    date_str = dt_local.strftime("%d/%m/%Y")
    time_str = dt_local.strftime("%I:%M %p")

    # 3. Header Information
    # Line 1: Underline Y=255 -> text Y=230
    draw.text((435, 230), str(invoice_number), fill=c_black, font=font_bold)
    stylist = stylist_name or "Team Member"
    draw.text((805, 230), stylist[:18], fill=c_black, font=font_regular)

    # Line 2: Underline Y=297 -> text Y=272
    draw.text((435, 272), date_str, fill=c_black, font=font_regular)
    c_name = customer_name or "Walk-in Guest"
    draw.text((805, 272), c_name[:20], fill=c_black, font=font_bold)

    # Line 3: Underline Y=338 -> text Y=313
    draw.text((435, 313), time_str, fill=c_black, font=font_regular)
    c_phone = customer_phone or "-"
    draw.text((805, 313), c_phone[:18], fill=c_black, font=font_regular)

    # 4. Table Row Items
    # Row underlines: 525, 581, 635, 687, 743, 797, 848, 903, 957, 1006
    row_underlines = [525, 581, 635, 687, 743, 797, 848, 903, 957, 1006]

    for idx, item in enumerate(items[:10]):
        underline_y = row_underlines[idx]
        text_y = underline_y - 24 # baseline sits cleanly above underline

        # Row number
        # (Template already has numbers 1..10 printed, but we ensure clean alignment)

        # Service name & variant
        svc_name = str(item.get("service_name") or item.get("name") or "Service").strip()
        variant = item.get("variant_name")

        if len(svc_name) > 20:
            svc_name = svc_name[:18] + ".."
        
        draw.text((365, text_y), svc_name, fill=c_black, font=font_item_name)

        # Stylist
        item_stylist = item.get("stylist_name") or stylist_name or "-"
        if len(item_stylist) > 11:
            item_stylist = item_stylist[:9] + ".."
        draw.text((580, text_y), item_stylist, fill=c_gray, font=font_small)

        # Qty (centered at 712)
        qty = str(item.get("quantity", 1))
        bbox = draw.textbbox((0, 0), qty, font=font_regular)
        draw.text((712 - (bbox[2] - bbox[0]) // 2, text_y), qty, fill=c_black, font=font_regular)

        # Price (₹) (right aligned at 840)
        unit_price = float(item.get("unit_price", 0))
        price_str = f"{unit_price:,.2f}"
        bbox = draw.textbbox((0, 0), price_str, font=font_regular)
        draw.text((840 - (bbox[2] - bbox[0]), text_y), price_str, fill=c_black, font=font_regular)

        # Amount (₹) (right aligned at 970)
        amount = float(item.get("total_price", unit_price * int(qty)))
        amount_str = f"{amount:,.2f}"
        bbox = draw.textbbox((0, 0), amount_str, font=font_bold)
        draw.text((970 - (bbox[2] - bbox[0]), text_y), amount_str, fill=c_black, font=font_bold)

    # 5. Payment Details Box (Left Box)
    # Underlines: 1141, 1175, 1207, 1237, 1269
    mode_text = payment_method.upper()
    if payment_provider:
        mode_text += f" ({payment_provider})"

    tx_id = transaction_reference or "VERIFIED-POS"
    amt_paid_str = f"₹ {total_amount:,.2f}"
    balance_str = "₹ 0.00"
    status_str = "PAID & VERIFIED"

    draw.text((495, 1118), mode_text[:18], fill=c_black, font=font_small_bold)
    draw.text((495, 1152), tx_id[:18], fill=c_black, font=font_small)
    draw.text((495, 1184), amt_paid_str, fill=c_black, font=font_small_bold)
    draw.text((495, 1214), balance_str, fill=c_black, font=font_small)
    draw.text((495, 1246), status_str, fill=c_green, font=font_small_bold)

    # 6. Totals Box (Right Box)
    # Underlines: 1111, 1151, 1194
    subtotal_str = f"₹ {subtotal:,.2f}"
    disc_str = f"- ₹ {discount_amount:,.2f}" if discount_amount > 0 else "₹ 0.00"
    tax_str = f"₹ {tax_amount:,.2f}" if tax_amount > 0 else "Not applicable"

    # Subtotal (underline 1111 -> text Y=1088, right aligned at 965)
    bbox = draw.textbbox((0, 0), subtotal_str, font=font_regular)
    draw.text((965 - (bbox[2] - bbox[0]), 1088), subtotal_str, fill=c_black, font=font_regular)

    # Discount (underline 1151 -> text Y=1128)
    bbox = draw.textbbox((0, 0), disc_str, font=font_regular)
    draw.text((965 - (bbox[2] - bbox[0]), 1128), disc_str, fill=c_green if discount_amount > 0 else c_black, font=font_regular)

    # GST / Tax (underline 1194 -> text Y=1171)
    bbox = draw.textbbox((0, 0), tax_str, font=font_regular)
    draw.text((965 - (bbox[2] - bbox[0]), 1171), tax_str, fill=c_black, font=font_regular)

    # 7. TOTAL AMOUNT (₹) Red Banner (X: 674..999, Y: 1216..1286)
    # The printed text 'TOTAL AMOUNT (₹)' ends around X=860. Value is placed at X=870..975.
    total_str = f"₹ {total_amount:,.2f}"
    bbox = draw.textbbox((0, 0), total_str, font=font_total_white)
    text_width = bbox[2] - bbox[0]
    draw.text((975 - text_width, 1238), total_str, fill=c_white, font=font_total_white)

    # 8. Save output
    if not output_path:
        storage_dir = Path("storage/invoices")
        storage_dir.mkdir(parents=True, exist_ok=True)
        safe_inv = invoice_number.replace("/", "_").replace("\\", "_")
        output_path = str(storage_dir / f"{safe_inv}.png")
    else:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    base_img.save(output_path, format="PNG", quality=95, optimize=True)
    return str(output_path)
