import io
import os
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo
from typing import Dict, Any, List, Optional

from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Table,
    TableStyle,
    Spacer,
    HRFlowable,
    KeepTogether,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


# ==============================================================================
# FONT REGISTRATION (TrueType with Unicode Rupee ₹ fallback)
# ==============================================================================

FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

font_candidates = [
    ("C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/segoeuib.ttf"),
    ("C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf"),
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
]

for reg_path, bold_path in font_candidates:
    if os.path.exists(reg_path) and os.path.exists(bold_path):
        try:
            pdfmetrics.registerFont(TTFont("TrimzFont", reg_path))
            pdfmetrics.registerFont(TTFont("TrimzFont-Bold", bold_path))
            FONT_REGULAR = "TrimzFont"
            FONT_BOLD = "TrimzFont-Bold"
            break
        except Exception:
            continue


# ==============================================================================
# NUMBERED CANVAS (2-pass page numbering & footer)
# ==============================================================================

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_footer(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_footer(self, page_count: int):
        self.saveState()
        # Thin divider line
        self.setStrokeColor(colors.HexColor("#E8E5E3"))
        self.setLineWidth(0.5)
        self.line(36, 32, A4[0] - 36, 32)

        # Footer labels
        self.setFont(FONT_REGULAR, 7.5)
        self.setFillColor(colors.HexColor("#737373"))
        self.drawString(36, 20, "Trimz Salon Financial Operations — Confidential Business Record")
        self.drawRightString(A4[0] - 36, 20, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


# ==============================================================================
# HELPERS
# ==============================================================================

def format_currency_inr(val: Any) -> str:
    """Formats amount as Indian Rupee string: ₹12,345.00"""
    try:
        amt = Decimal(str(val))
        return f"₹{amt:,.2f}"
    except Exception:
        return "₹0.00"

def format_date_label(date_str: str) -> str:
    """Formats YYYY-MM-DD into DD Mon YYYY (e.g. 01 Oct 2026)"""
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.strftime("%d %b %Y")
    except Exception:
        return date_str


# ==============================================================================
# PDF GENERATOR
# ==============================================================================

def generate_daily_sales_pdf(report_data: Dict[str, Any]) -> bytes:
    """
    Renders an authoritative, filter-aware PDF Daily Sales Report for Trimz Salon.
    Table columns in strict order:
      1. S. No.
      2. Date
      3. Total Number of Sales
      4. Total Revenue
      5. Payment Method Breakdown
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=45,
    )

    # Styles
    styles = getSampleStyleSheet()

    brand_title_style = ParagraphStyle(
        "BrandTitle",
        fontName=FONT_BOLD,
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#171717"),
    )
    report_subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        fontName=FONT_BOLD,
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#E60023"),
    )
    meta_style = ParagraphStyle(
        "MetaText",
        fontName=FONT_REGULAR,
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#525252"),
        alignment=2, # Right aligned
    )
    meta_bold = ParagraphStyle(
        "MetaBold",
        fontName=FONT_BOLD,
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#171717"),
        alignment=2,
    )

    card_label_style = ParagraphStyle(
        "CardLabel",
        fontName=FONT_REGULAR,
        fontSize=7.5,
        leading=9.5,
        textColor=colors.HexColor("#737373"),
    )
    card_value_style = ParagraphStyle(
        "CardValue",
        fontName=FONT_BOLD,
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#171717"),
    )
    card_sub_style = ParagraphStyle(
        "CardSub",
        fontName=FONT_REGULAR,
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#404040"),
    )

    table_header_style = ParagraphStyle(
        "TableHeader",
        fontName=FONT_BOLD,
        fontSize=8.5,
        leading=11,
        textColor=colors.white,
    )
    table_cell_style = ParagraphStyle(
        "TableCell",
        fontName=FONT_REGULAR,
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#171717"),
    )
    table_cell_right = ParagraphStyle(
        "TableCellRight",
        fontName=FONT_REGULAR,
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#171717"),
        alignment=2,
    )
    table_cell_center = ParagraphStyle(
        "TableCellCenter",
        fontName=FONT_REGULAR,
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor("#171717"),
        alignment=1,
    )
    breakdown_cell_style = ParagraphStyle(
        "BreakdownCell",
        fontName=FONT_REGULAR,
        fontSize=7.8,
        leading=10,
        textColor=colors.HexColor("#262626"),
    )
    total_cell_style = ParagraphStyle(
        "TotalCell",
        fontName=FONT_BOLD,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#171717"),
    )
    total_cell_right = ParagraphStyle(
        "TotalCellRight",
        fontName=FONT_BOLD,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#E60023"),
        alignment=2,
    )

    story = []

    # --------------------------------------------------------------------------
    # 1. HEADER BRANDING & FILTER RANGE METADATA
    # --------------------------------------------------------------------------
    business_name = report_data.get("business_name") or "Trimz Unisex Salon"
    from_date_str = report_data.get("from_date", "")
    to_date_str = report_data.get("to_date", "")
    from_formatted = format_date_label(from_date_str)
    to_formatted = format_date_label(to_date_str)

    # Generated timestamp (IST)
    gen_dt = report_data.get("generated_at") or datetime.now(ZoneInfo("Asia/Kolkata"))
    gen_str = gen_dt.strftime("%d %b %Y, %I:%M %p IST")

    header_left = [
        Paragraph(f"<b>{business_name.upper()}</b>", brand_title_style),
        Spacer(1, 2),
        Paragraph("DAILY SALES REPORT", report_subtitle_style),
    ]
    if report_data.get("business_address"):
        header_left.append(Paragraph(str(report_data.get("business_address")), card_label_style))

    header_right = [
        Paragraph(f"<b>Date Range:</b> {from_formatted} &ndash; {to_formatted}", meta_bold),
        Spacer(1, 2),
        Paragraph(f"Generated: {gen_str}", meta_style),
        Paragraph("Status: Verified Settled Sales", meta_style),
    ]

    header_table = Table(
        [[header_left, header_right]],
        colWidths=[310, 213],
    )
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))

    # Red accent rule
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#E60023"), spaceAfter=10))

    # --------------------------------------------------------------------------
    # 2. EXECUTIVE SUMMARY KPI CARDS
    # --------------------------------------------------------------------------
    total_sales = report_data.get("total_sales", 0)
    total_revenue = report_data.get("total_revenue", Decimal("0.00"))
    payment_methods = report_data.get("payment_methods", {})

    pm_parts = []
    for m in ["CASH", "UPI", "CARD", "OTHER"]:
        amt = payment_methods.get(m, Decimal("0.00"))
        if amt > 0:
            label = "Cash" if m == "CASH" else ("UPI" if m == "UPI" else ("Card" if m == "CARD" else "Other"))
            pm_parts.append(f"<b>{label}:</b> {format_currency_inr(amt)}")
    if not pm_parts:
        summary_pm_text = "No payments recorded"
    else:
        summary_pm_text = " &bull; ".join(pm_parts)

    kpi_card_1 = [
        Paragraph("TOTAL SALES", card_label_style),
        Spacer(1, 2),
        Paragraph(f"{total_sales}", card_value_style),
        Paragraph("Completed Bills", card_label_style),
    ]
    kpi_card_2 = [
        Paragraph("TOTAL REVENUE", card_label_style),
        Spacer(1, 2),
        Paragraph(format_currency_inr(total_revenue), card_value_style),
        Paragraph(f"Period Gross ({from_formatted} to {to_formatted})", card_label_style),
    ]
    kpi_card_3 = [
        Paragraph("PAYMENT METHOD BREAKDOWN", card_label_style),
        Spacer(1, 3),
        Paragraph(summary_pm_text, card_sub_style),
    ]

    kpi_table = Table(
        [[kpi_card_1, kpi_card_2, kpi_card_3]],
        colWidths=[110, 140, 273],
    )
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FBFBFA")),
        ("BOX", (0, 0), (-1, -1), 0.75, colors.HexColor("#E8E5E3")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E8E5E3")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 14))

    # --------------------------------------------------------------------------
    # 3. DAILY SALES TABLE
    # Columns in strict order:
    #   1. S. No.
    #   2. Date
    #   3. Total Number of Sales
    #   4. Total Revenue
    #   5. Payment Method Breakdown
    # --------------------------------------------------------------------------
    table_data = [
        [
            Paragraph("<b>S. No.</b>", table_header_style),
            Paragraph("<b>Date</b>", table_header_style),
            Paragraph("<b>Total Sales</b>", ParagraphStyle("THRight", parent=table_header_style, alignment=2)),
            Paragraph("<b>Total Revenue</b>", ParagraphStyle("THRight2", parent=table_header_style, alignment=2)),
            Paragraph("<b>Payment Method Breakdown</b>", table_header_style),
        ]
    ]

    daily_rows: List[Dict[str, Any]] = report_data.get("daily_rows", [])
    for row in daily_rows:
        s_no = str(row.get("s_no", ""))
        date_lbl = format_date_label(row.get("date_str", ""))
        sales_cnt = str(row.get("sales_count", 0))
        rev_str = format_currency_inr(row.get("total_revenue", 0))
        breakdown_str = row.get("payment_breakdown", "-") or "-"

        table_data.append([
            Paragraph(s_no, table_cell_center),
            Paragraph(date_lbl, table_cell_style),
            Paragraph(sales_cnt, table_cell_right),
            Paragraph(rev_str, table_cell_right),
            Paragraph(breakdown_str, breakdown_cell_style),
        ])

    # Summary Reconciled Total Row
    table_data.append([
        Paragraph("<b>Total</b>", total_cell_style),
        Paragraph("", total_cell_style),
        Paragraph(f"<b>{total_sales}</b>", total_cell_right),
        Paragraph(f"<b>{format_currency_inr(total_revenue)}</b>", total_cell_right),
        Paragraph(f"<b>{summary_pm_text}</b>", ParagraphStyle("TotalBreakdown", parent=breakdown_cell_style, fontName=FONT_BOLD)),
    ])

    # Widths sum to 523pt (A4 width 595 - 72pt margins)
    col_widths = [36, 75, 72, 85, 255]
    report_table = Table(table_data, colWidths=col_widths, repeatRows=1)

    t_style = [
        # Table Header Styling
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E60023")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E8E5E3")),
        # Total Row Styling
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#F0EFEB")),
        ("LINEABOVE", (0, -1), (-1, -1), 1.25, colors.HexColor("#171717")),
    ]

    # Alternating row colors for data rows
    for i in range(1, len(table_data) - 1):
        bg = colors.HexColor("#FFFFFF") if i % 2 == 1 else colors.HexColor("#FBFBFA")
        t_style.append(("BACKGROUND", (0, i), (-1, i), bg))

    report_table.setStyle(TableStyle(t_style))
    story.append(report_table)

    # Build PDF with NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()
