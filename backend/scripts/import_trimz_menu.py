"""
Trimz Salon — Canonical Menu Import Script
Imports the complete official Men's and Women's service menus from Trimz Salon PDF price lists.
Idempotent: Safe to run multiple times without creating duplicates.
Supports both SQLite local dev (trimz.db) and Supabase PostgreSQL.
"""

import sys
import os
import asyncio
import re
from decimal import Decimal
from typing import Dict, List, Any, Optional

# Set up backend import path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text
from app.core.config import settings
from app.models.business import Business
from app.models.service import ServiceCategory, Service

def slugify(text: str) -> str:
    cleaned = re.sub(r'[^a-zA-Z0-9]+', '-', text).strip('-').lower()
    return cleaned or "item"

MENS_MENU: List[Dict[str, Any]] = [
    {
        "category": "Hair Cut",
        "slug": "mens-hair-cut",
        "department": "Men",
        "display_order": 10,
        "services": [
            {"name": "Kids Hair Cut", "variant": None, "price": Decimal("99.00"), "duration": 20, "audience": "Kids"},
            {"name": "Hair Cut", "variant": "Regular", "price": Decimal("149.00"), "duration": 30, "audience": "Male"},
            {"name": "Change of Style", "variant": None, "price": Decimal("199.00"), "duration": 35, "audience": "Male"},
            {"name": "Shaving", "variant": None, "price": Decimal("69.00"), "duration": 15, "audience": "Male"},
            {"name": "Trimming", "variant": None, "price": Decimal("79.00"), "duration": 15, "audience": "Male"},
        ]
    },
    {
        "category": "Hair Cut Combo",
        "slug": "mens-hair-cut-combo",
        "department": "Men",
        "display_order": 20,
        "services": [
            {
                "name": "Hair Cut Combo 1",
                "variant": "Cut + Trim + D-Tan",
                "price": Decimal("449.00"),
                "duration": 50,
                "audience": "Male",
                "combo_items": "Hair Cut, Beard Trim / Shaving, D-Tan"
            },
            {
                "name": "Hair Cut Combo 2",
                "variant": "Cut + Trim + D-Tan + Head Massage",
                "price": Decimal("549.00"),
                "duration": 65,
                "audience": "Male",
                "combo_items": "Hair Cut, Beard Trim / Shaving, D-Tan, Head Massage"
            },
            {
                "name": "Hair Cut Combo 3",
                "variant": "Cut + Trim + D-Tan + Massage + Facial",
                "price": Decimal("649.00"),
                "duration": 80,
                "audience": "Male",
                "combo_items": "Hair Cut, Beard Trim / Shaving, D-Tan, Head Massage, Facial"
            },
        ]
    },
    {
        "category": "Massage",
        "slug": "mens-massage",
        "department": "Men",
        "display_order": 30,
        "services": [
            {"name": "Head Massage", "variant": "15 Min", "price": Decimal("149.00"), "duration": 15, "audience": "Male"},
            {"name": "Head Massage", "variant": "30 Min", "price": Decimal("299.00"), "duration": 30, "audience": "Male"},
            {"name": "Foot Massage", "variant": "15 Min", "price": Decimal("249.00"), "duration": 15, "audience": "Male"},
        ]
    },
    {
        "category": "D-Tan Pack",
        "slug": "mens-d-tan-pack",
        "department": "Men",
        "display_order": 40,
        "services": [
            {"name": "D-Tan Basic", "variant": None, "price": Decimal("299.00"), "duration": 20, "audience": "Male"},
            {"name": "D-Tan Deep Clean", "variant": None, "price": Decimal("799.00"), "duration": 30, "audience": "Male"},
            {"name": "D-Tan Treatment", "variant": "Face + Neck + Back Neck", "price": Decimal("999.00"), "duration": 40, "audience": "Male"},
        ]
    },
    {
        "category": "Facial",
        "slug": "mens-facial",
        "department": "Men",
        "display_order": 50,
        "services": [
            {"name": "Basic Cleanup", "variant": None, "price": Decimal("299.00"), "duration": 25, "audience": "Male"},
            {"name": "Acne Cleanup", "variant": None, "price": Decimal("399.00"), "duration": 30, "audience": "Male"},
            {"name": "Charcoal Facial", "variant": None, "price": Decimal("699.00"), "duration": 40, "audience": "Male"},
            {"name": "Fruit Facial", "variant": None, "price": Decimal("799.00"), "duration": 45, "audience": "Male"},
            {"name": "Gold Glow", "variant": None, "price": Decimal("1099.00"), "duration": 50, "audience": "Male"},
            {"name": "Glowita", "variant": None, "price": Decimal("1099.00"), "duration": 50, "audience": "Male"},
            {"name": "Wine Facial", "variant": None, "price": Decimal("1199.00"), "duration": 50, "audience": "Male"},
            {"name": "Pearl Facial", "variant": None, "price": Decimal("1199.00"), "duration": 50, "audience": "Male"},
            {"name": "Skin Brightening", "variant": None, "price": Decimal("1199.00"), "duration": 50, "audience": "Male"},
            {"name": "Skin Whitening", "variant": None, "price": Decimal("1199.00"), "duration": 50, "audience": "Male"},
            {"name": "Sensi Glow", "variant": None, "price": Decimal("1399.00"), "duration": 55, "audience": "Male"},
            {"name": "Tan Clear", "variant": None, "price": Decimal("1499.00"), "duration": 55, "audience": "Male"},
            {"name": "Hydra Facial Basic", "variant": None, "price": Decimal("1999.00"), "duration": 60, "audience": "Male"},
            {"name": "Hydra Facial Advance", "variant": None, "price": Decimal("2999.00"), "duration": 75, "audience": "Male"},
        ]
    },
    {
        "category": "Coloring",
        "slug": "mens-coloring",
        "department": "Men",
        "display_order": 60,
        "services": [
            {"name": "Highlight Streaks", "variant": "Per Streak", "price": Decimal("100.00"), "duration": 15, "audience": "Male"},
            {"name": "Henna Coloring", "variant": None, "price": Decimal("199.00"), "duration": 35, "audience": "Male"},
            {"name": "Natural Henna Treatment", "variant": None, "price": Decimal("199.00"), "duration": 35, "audience": "Male"},
            {"name": "Gel Hair Colour", "variant": None, "price": Decimal("299.00"), "duration": 30, "audience": "Male"},
            {"name": "L'Oréal Professional Colour", "variant": None, "price": Decimal("499.00"), "duration": 35, "audience": "Male"},
            {"name": "Root Colour Touch-Up", "variant": None, "price": Decimal("699.00"), "duration": 40, "audience": "Male"},
            {"name": "Full Hair Highlights", "variant": "Onwards", "price": Decimal("999.00"), "duration": 60, "audience": "Male", "is_variable_price": True},
            {"name": "Global Hair Colour", "variant": "Onwards", "price": Decimal("1699.00"), "duration": 60, "audience": "Male", "is_variable_price": True},
            {"name": "Creative Fashion Colour", "variant": "Onwards", "price": Decimal("1999.00"), "duration": 75, "audience": "Male", "is_variable_price": True},
            {"name": "Global Fashion Colour", "variant": "Onwards", "price": Decimal("2199.00"), "duration": 75, "audience": "Male", "is_variable_price": True},
        ]
    },
    {
        "category": "Hair Spa",
        "slug": "mens-hair-spa",
        "department": "Men",
        "display_order": 70,
        "services": [
            {"name": "Anti-Dandruff Treatment", "variant": None, "price": Decimal("1999.00"), "duration": 45, "audience": "Male"},
            {"name": "Hair Smoothening Treatment", "variant": None, "price": Decimal("1999.00"), "duration": 60, "audience": "Male"},
            {"name": "Anti-Hair Fall Treatment", "variant": None, "price": Decimal("1999.00"), "duration": 45, "audience": "Male"},
            {"name": "Hair Repair & Restore Treatment", "variant": None, "price": Decimal("2999.00"), "duration": 60, "audience": "Male"},
        ]
    },
    {
        "category": "Straightening Treatment",
        "slug": "mens-straightening-treatment",
        "department": "Men",
        "display_order": 80,
        "services": [
            {"name": "Front Hair Straightening", "variant": "Front", "price": Decimal("799.00"), "duration": 45, "audience": "Male"},
            {"name": "Hair Straightening", "variant": "Short Hair", "price": Decimal("999.00"), "duration": 60, "audience": "Male"},
            {"name": "Hair Straightening", "variant": "Medium Hair", "price": Decimal("1999.00"), "duration": 90, "audience": "Male"},
            {"name": "Hair Straightening", "variant": "Long Hair", "price": Decimal("2999.00"), "duration": 120, "audience": "Male"},
        ]
    },
    {
        "category": "Keratin Treatment",
        "slug": "mens-keratin-treatment",
        "department": "Men",
        "display_order": 90,
        "services": [
            {"name": "Keratin Treatment", "variant": "Short Hair", "price": Decimal("1999.00"), "duration": 60, "audience": "Male"},
            {"name": "Keratin Treatment", "variant": "Medium Hair", "price": Decimal("2999.00"), "duration": 90, "audience": "Male"},
            {"name": "Keratin Treatment", "variant": "Long Hair", "price": Decimal("3999.00"), "duration": 120, "audience": "Male"},
        ]
    },
    {
        "category": "Manicure",
        "slug": "mens-manicure",
        "department": "Men",
        "display_order": 100,
        "services": [
            {"name": "Regular Manicure", "variant": "Regular", "price": Decimal("600.00"), "duration": 30, "audience": "Male"},
            {"name": "Classic Manicure", "variant": "Classic", "price": Decimal("800.00"), "duration": 45, "audience": "Male"},
        ]
    },
    {
        "category": "Pedicure",
        "slug": "mens-pedicure",
        "department": "Men",
        "display_order": 110,
        "services": [
            {"name": "Regular Pedicure", "variant": "Regular", "price": Decimal("500.00"), "duration": 30, "audience": "Male"},
            {"name": "Classic Pedicure", "variant": "Classic", "price": Decimal("600.00"), "duration": 45, "audience": "Male"},
        ]
    },
]

WOMENS_MENU: List[Dict[str, Any]] = [
    {
        "category": "Hair Cut",
        "slug": "womens-hair-cut",
        "department": "Women",
        "display_order": 200,
        "services": [
            {"name": "Straight Haircut", "variant": None, "price": Decimal("149.00"), "duration": 25, "audience": "Female"},
            {"name": "Basic Haircut", "variant": None, "price": Decimal("349.00"), "duration": 30, "audience": "Female"},
            {"name": "U Cut", "variant": None, "price": Decimal("249.00"), "duration": 30, "audience": "Female"},
            {"name": "Deep U Cut", "variant": None, "price": Decimal("349.00"), "duration": 35, "audience": "Female"},
            {"name": "Layer Cut", "variant": None, "price": Decimal("799.00"), "duration": 45, "audience": "Female"},
            {"name": "Step Cut", "variant": None, "price": Decimal("649.00"), "duration": 40, "audience": "Female"},
            {"name": "Feather Cut", "variant": None, "price": Decimal("899.00"), "duration": 45, "audience": "Female"},
            {"name": "Butterfly Cut", "variant": None, "price": Decimal("999.00"), "duration": 50, "audience": "Female"},
            {"name": "Creative Haircut", "variant": None, "price": Decimal("999.00"), "duration": 50, "audience": "Female"},
            {"name": "Blend Cut", "variant": None, "price": Decimal("999.00"), "duration": 50, "audience": "Female"},
        ]
    },
    {
        "category": "Threading",
        "slug": "womens-threading",
        "department": "Women",
        "display_order": 210,
        "services": [
            {"name": "Upper Lips", "variant": None, "price": Decimal("49.00"), "duration": 5, "audience": "Female"},
            {"name": "Forehead", "variant": None, "price": Decimal("20.00"), "duration": 5, "audience": "Female"},
            {"name": "Chin", "variant": None, "price": Decimal("49.00"), "duration": 5, "audience": "Female"},
            {"name": "Eyebrows", "variant": None, "price": Decimal("99.00"), "duration": 10, "audience": "Female"},
            {"name": "Side Locks", "variant": None, "price": Decimal("99.00"), "duration": 10, "audience": "Female"},
            {"name": "Full Face", "variant": None, "price": Decimal("199.00"), "duration": 20, "audience": "Female"},
        ]
    },
    {
        "category": "D-Tan & Bleach",
        "slug": "womens-d-tan-bleach",
        "department": "Women",
        "display_order": 220,
        "services": [
            {"name": "Basic Face D-Tan", "variant": "Basic", "price": Decimal("299.00"), "duration": 20, "audience": "Female"},
            {"name": "Advanced Face D-Tan", "variant": "Advanced", "price": Decimal("599.00"), "duration": 30, "audience": "Female"},
            {"name": "Premium Face D-Tan", "variant": "Premium", "price": Decimal("799.00"), "duration": 40, "audience": "Female"},
        ]
    },
    {
        "category": "Facials",
        "slug": "womens-facials",
        "department": "Women",
        "display_order": 230,
        "services": [
            {"name": "Fruit Facial", "variant": None, "price": Decimal("1099.00"), "duration": 45, "audience": "Female"},
            {"name": "Skin Brightening Facial", "variant": None, "price": Decimal("1299.00"), "duration": 50, "audience": "Female"},
            {"name": "Skin Lightening Facial", "variant": None, "price": Decimal("1299.00"), "duration": 50, "audience": "Female"},
            {"name": "Gold Facial", "variant": None, "price": Decimal("1499.00"), "duration": 55, "audience": "Female"},
            {"name": "Diamond Facial", "variant": None, "price": Decimal("1599.00"), "duration": 60, "audience": "Female"},
            {"name": "Wine Facial", "variant": None, "price": Decimal("1199.00"), "duration": 50, "audience": "Female"},
            {"name": "Advanced Tan Removal Facial", "variant": None, "price": Decimal("1999.00"), "duration": 60, "audience": "Female"},
            {"name": "O3+ Facial", "variant": None, "price": Decimal("2999.00"), "duration": 75, "audience": "Female"},
            {"name": "Cheryl's Facial", "variant": None, "price": Decimal("1499.00"), "duration": 60, "audience": "Female"},
            {"name": "Bridal Glow Facial", "variant": None, "price": Decimal("2999.00"), "duration": 90, "audience": "Female"},
            {"name": "Hydra Facial Basic", "variant": "Basic", "price": Decimal("1999.00"), "duration": 60, "audience": "Female"},
            {"name": "Hydra Facial", "variant": "Advance", "price": Decimal("2999.00"), "duration": 75, "audience": "Female"},
        ]
    },
    {
        "category": "Face Cleanup",
        "slug": "womens-face-cleanup",
        "department": "Women",
        "display_order": 240,
        "services": [
            {"name": "Fruit Cleanup", "variant": None, "price": Decimal("499.00"), "duration": 30, "audience": "Female"},
            {"name": "Herbal Cleanup", "variant": None, "price": Decimal("599.00"), "duration": 35, "audience": "Female"},
            {"name": "Skin Brightening Cleanup", "variant": None, "price": Decimal("749.00"), "duration": 40, "audience": "Female"},
            {"name": "Instant Glow Cleanup", "variant": None, "price": Decimal("749.00"), "duration": 40, "audience": "Female"},
        ]
    },
    {
        "category": "Hair Colouring",
        "slug": "womens-hair-colouring",
        "department": "Women",
        "display_order": 250,
        "services": [
            {"name": "Root Touch-Up", "variant": None, "price": Decimal("1199.00"), "duration": 45, "audience": "Female"},
            {"name": "Global Colour", "variant": "Short Hair", "price": Decimal("1999.00"), "duration": 60, "audience": "Female"},
            {"name": "Global Colour", "variant": "Medium Hair", "price": Decimal("2499.00"), "duration": 75, "audience": "Female"},
            {"name": "Global Colour", "variant": "Long Hair", "price": Decimal("2999.00"), "duration": 90, "audience": "Female"},
            {"name": "Global Fashion Colour", "variant": "Short Hair", "price": Decimal("2799.00"), "duration": 75, "audience": "Female"},
            {"name": "Global Fashion Colour", "variant": "Medium Hair", "price": Decimal("3199.00"), "duration": 90, "audience": "Female"},
            {"name": "Global Fashion Colour", "variant": "Long Hair", "price": Decimal("3399.00"), "duration": 105, "audience": "Female"},
            {"name": "Full Highlights", "variant": None, "price": Decimal("2999.00"), "duration": 90, "audience": "Female"},
            {"name": "Highlight Streak", "variant": "Per Streak", "price": Decimal("249.00"), "duration": 20, "audience": "Female"},
            {"name": "Natural Henna", "variant": None, "price": Decimal("699.00"), "duration": 45, "audience": "Female"},
            {"name": "Gel Colour", "variant": None, "price": Decimal("1499.00"), "duration": 45, "audience": "Female"},
            {"name": "Creative Colour", "variant": "Short Hair", "price": Decimal("2999.00"), "duration": 90, "audience": "Female"},
            {"name": "Creative Colour", "variant": "Medium Hair", "price": Decimal("3499.00"), "duration": 105, "audience": "Female"},
            {"name": "Creative Colour", "variant": "Long Hair", "price": Decimal("3999.00"), "duration": 120, "audience": "Female"},
        ]
    },
    {
        "category": "Hair Treatments",
        "slug": "womens-hair-treatments",
        "department": "Women",
        "display_order": 260,
        "services": [
            {"name": "Hair Smoothening", "variant": None, "price": Decimal("1499.00"), "duration": 60, "audience": "Female"},
            {"name": "Hair Repair Treatment", "variant": None, "price": Decimal("2499.00"), "duration": 60, "audience": "Female"},
            {"name": "Anti-Dandruff Treatment", "variant": None, "price": Decimal("2499.00"), "duration": 45, "audience": "Female"},
            {"name": "Anti-Hair Fall Treatment", "variant": None, "price": Decimal("1999.00"), "duration": 45, "audience": "Female"},
            {"name": "Moisture Repair Treatment", "variant": None, "price": Decimal("2499.00"), "duration": 60, "audience": "Female"},
            {"name": "Keratin Restore Treatment", "variant": None, "price": Decimal("3499.00"), "duration": 75, "audience": "Female"},
            {"name": "Heal Peel Treatment", "variant": None, "price": Decimal("1799.00"), "duration": 45, "audience": "Female"},
        ]
    },
    {
        "category": "Hair Spa Treatments",
        "slug": "womens-hair-spa-treatments",
        "department": "Women",
        "display_order": 270,
        "services": [
            {"name": "Hair Fall Control Spa", "variant": None, "price": Decimal("999.00"), "duration": 45, "audience": "Female", "is_variable_price": True},
            {"name": "Hair Repair Spa", "variant": None, "price": Decimal("1299.00"), "duration": 50, "audience": "Female", "is_variable_price": True},
            {"name": "Smoothening Spa", "variant": None, "price": Decimal("1599.00"), "duration": 60, "audience": "Female", "is_variable_price": True},
            {"name": "Anti-Dandruff Spa", "variant": None, "price": Decimal("1599.00"), "duration": 50, "audience": "Female", "is_variable_price": True},
            {"name": "Itchy Scalp Treatment", "variant": None, "price": Decimal("1599.00"), "duration": 50, "audience": "Female", "is_variable_price": True},
            {"name": "Head Steaming", "variant": "15 Min", "price": Decimal("199.00"), "duration": 15, "audience": "Female"},
        ]
    },
    {
        "category": "Hair Straightening",
        "slug": "womens-hair-straightening",
        "department": "Women",
        "display_order": 280,
        "services": [
            {"name": "Hair Straightening", "variant": "Short Hair", "price": Decimal("4999.00"), "duration": 120, "audience": "Female"},
            {"name": "Hair Straightening", "variant": "Medium Hair", "price": Decimal("5999.00"), "duration": 150, "audience": "Female"},
            {"name": "Hair Straightening", "variant": "Long Hair", "price": Decimal("6999.00"), "duration": 180, "audience": "Female"},
        ]
    },
    {
        "category": "Keratin Treatment",
        "slug": "womens-keratin-treatment",
        "department": "Women",
        "display_order": 290,
        "services": [
            {"name": "Keratin Treatment", "variant": "Short Hair", "price": Decimal("6999.00"), "duration": 120, "audience": "Female"},
            {"name": "Keratin Treatment", "variant": "Medium Hair", "price": Decimal("7999.00"), "duration": 150, "audience": "Female"},
            {"name": "Keratin Treatment", "variant": "Long Hair", "price": Decimal("9999.00"), "duration": 180, "audience": "Female"},
        ]
    },
    {
        "category": "Massage Services",
        "slug": "womens-massage-services",
        "department": "Women",
        "display_order": 300,
        "services": [
            {"name": "Head Oil Massage", "variant": "15 Mins", "price": Decimal("499.00"), "duration": 15, "audience": "Female"},
            {"name": "Head Oil Massage", "variant": "30 Mins", "price": Decimal("699.00"), "duration": 30, "audience": "Female"},
            {"name": "Head Oil Massage with Hair Wash", "variant": None, "price": Decimal("799.00"), "duration": 40, "audience": "Female"},
            {"name": "Head Steaming", "variant": "15 Mins", "price": Decimal("199.00"), "duration": 15, "audience": "Female"},
            {"name": "Back & Neck Massage", "variant": None, "price": Decimal("599.00"), "duration": 30, "audience": "Female"},
            {"name": "Foot Massage", "variant": "Standard", "price": Decimal("499.00"), "duration": 30, "audience": "Female"},
            {"name": "Hand Massage", "variant": None, "price": Decimal("499.00"), "duration": 25, "audience": "Female"},
            {"name": "Foot Massage", "variant": "15 Mins", "price": Decimal("149.00"), "duration": 15, "audience": "Female"},
            {"name": "Full Body Massage", "variant": None, "price": Decimal("2499.00"), "duration": 60, "audience": "Female"},
        ]
    },
    {
        "category": "Pedicure",
        "slug": "womens-pedicure",
        "department": "Women",
        "display_order": 310,
        "services": [
            {"name": "Classic Pedicure", "variant": "Classic", "price": Decimal("599.00"), "duration": 35, "audience": "Female"},
            {"name": "Regular Pedicure", "variant": "Regular", "price": Decimal("799.00"), "duration": 45, "audience": "Female"},
            {"name": "Organic Pedicure", "variant": "Organic", "price": Decimal("899.00"), "duration": 50, "audience": "Female"},
            {"name": "Crystal Pedicure", "variant": "Crystal", "price": Decimal("999.00"), "duration": 60, "audience": "Female"},
        ]
    },
    {
        "category": "Manicure",
        "slug": "womens-manicure",
        "department": "Women",
        "display_order": 320,
        "services": [
            {"name": "Classic Manicure", "variant": "Classic", "price": Decimal("299.00"), "duration": 30, "audience": "Female"},
            {"name": "Regular Manicure", "variant": "Regular", "price": Decimal("699.00"), "duration": 40, "audience": "Female"},
            {"name": "Organic Manicure", "variant": "Organic", "price": Decimal("799.00"), "duration": 45, "audience": "Female"},
            {"name": "Crystal Manicure", "variant": "Crystal", "price": Decimal("899.00"), "duration": 55, "audience": "Female"},
        ]
    },
    {
        "category": "Waxing",
        "slug": "womens-waxing",
        "department": "Women",
        "display_order": 330,
        "services": [
            {"name": "Full Arms Wax", "variant": "Full Arms", "price": Decimal("499.00"), "duration": 25, "audience": "Female"},
            {"name": "Half Arms Wax", "variant": "Half Arms", "price": Decimal("249.00"), "duration": 15, "audience": "Female"},
            {"name": "Full Legs Wax", "variant": "Full Legs", "price": Decimal("699.00"), "duration": 35, "audience": "Female"},
            {"name": "Half Legs Wax", "variant": "Half Legs", "price": Decimal("349.00"), "duration": 20, "audience": "Female"},
            {"name": "Full Back Wax", "variant": "Full Back", "price": Decimal("499.00"), "duration": 25, "audience": "Female"},
            {"name": "Full Body Wax", "variant": "Full Body", "price": Decimal("2199.00"), "duration": 75, "audience": "Female"},
            {"name": "Upper Lip Wax", "variant": "Upper Lip", "price": Decimal("79.00"), "duration": 5, "audience": "Female"},
            {"name": "Chin Wax", "variant": "Chin", "price": Decimal("79.00"), "duration": 5, "audience": "Female"},
            {"name": "Face Wax", "variant": "Face", "price": Decimal("299.00"), "duration": 15, "audience": "Female"},
            {"name": "Underarms Wax", "variant": "Underarms", "price": Decimal("149.00"), "duration": 10, "audience": "Female"},
        ]
    },
    {
        "category": "D-Tan",
        "slug": "womens-d-tan",
        "department": "Women",
        "display_order": 340,
        "services": [
            {"name": "Underarms D-Tan", "variant": "Underarms", "price": Decimal("149.00"), "duration": 10, "audience": "Female"},
            {"name": "Face D-Tan", "variant": "Face", "price": Decimal("499.00"), "duration": 20, "audience": "Female"},
            {"name": "Front / Back Neck D-Tan", "variant": "Front / Back Neck", "price": Decimal("199.00"), "duration": 15, "audience": "Female"},
            {"name": "Blouse Line D-Tan", "variant": "Blouse Line", "price": Decimal("199.00"), "duration": 15, "audience": "Female"},
            {"name": "Half Arms D-Tan", "variant": "Half Arms", "price": Decimal("399.00"), "duration": 20, "audience": "Female"},
            {"name": "Full Arms D-Tan", "variant": "Full Arms", "price": Decimal("699.00"), "duration": 30, "audience": "Female"},
            {"name": "Half Legs D-Tan", "variant": "Half Legs", "price": Decimal("599.00"), "duration": 25, "audience": "Female"},
            {"name": "Full Legs D-Tan", "variant": "Full Legs", "price": Decimal("999.00"), "duration": 40, "audience": "Female"},
            {"name": "Full Body D-Tan", "variant": "Full Body", "price": Decimal("2199.00"), "duration": 75, "audience": "Female"},
        ]
    },
]

async def ensure_sqlite_columns(engine):
    """Ensure SQLite columns exist if using SQLite."""
    if "sqlite" in settings.DATABASE_URL:
        async with engine.begin() as conn:
            # Check service_categories
            res = await conn.execute(text("PRAGMA table_info(service_categories)"))
            cat_cols = [row[1] for row in res.fetchall()]
            if "slug" not in cat_cols:
                await conn.execute(text("ALTER TABLE service_categories ADD COLUMN slug VARCHAR(100)"))
            if "department" not in cat_cols:
                await conn.execute(text("ALTER TABLE service_categories ADD COLUMN department VARCHAR(50) DEFAULT 'Unisex'"))

            # Check services
            res = await conn.execute(text("PRAGMA table_info(services)"))
            svc_cols = [row[1] for row in res.fetchall()]
            if "slug" not in svc_cols:
                await conn.execute(text("ALTER TABLE services ADD COLUMN slug VARCHAR(150)"))
            if "variant_name" not in svc_cols:
                await conn.execute(text("ALTER TABLE services ADD COLUMN variant_name VARCHAR(100)"))
            if "is_variable_price" not in svc_cols:
                await conn.execute(text("ALTER TABLE services ADD COLUMN is_variable_price BOOLEAN DEFAULT 0"))
            if "combo_items" not in svc_cols:
                await conn.execute(text("ALTER TABLE services ADD COLUMN combo_items TEXT"))

async def import_catalogue(business_id_str: Optional[str] = None):
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    await ensure_sqlite_columns(engine)
    
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Determine business
        if business_id_str:
            b_res = await session.execute(select(Business).where(Business.id == business_id_str))
            biz = b_res.scalar_one_or_none()
        else:
            b_res = await session.execute(select(Business).limit(1))
            biz = b_res.scalar_one_or_none()

        if not biz:
            print("ERROR: No business found in database. Please run bootstrap_owner.py first.")
            return False

        print(f"Importing catalog for Business: {biz.name} ({biz.id})")

        all_menus = MENS_MENU + WOMENS_MENU
        total_categories = 0
        total_services = 0

        for cat_data in all_menus:
            # Upsert Category
            cat_stmt = select(ServiceCategory).where(
                ServiceCategory.business_id == biz.id,
                ServiceCategory.slug == cat_data["slug"]
            )
            cat_res = await session.execute(cat_stmt)
            category = cat_res.scalar_one_or_none()

            if not category:
                # Also check by name and department
                cat_stmt2 = select(ServiceCategory).where(
                    ServiceCategory.business_id == biz.id,
                    ServiceCategory.name == cat_data["category"],
                    ServiceCategory.department == cat_data["department"]
                )
                cat_res2 = await session.execute(cat_stmt2)
                category = cat_res2.scalar_one_or_none()

            if not category:
                category = ServiceCategory(
                    business_id=biz.id,
                    name=cat_data["category"],
                    slug=cat_data["slug"],
                    department=cat_data["department"],
                    display_order=cat_data["display_order"],
                    is_active=True
                )
                session.add(category)
                await session.flush()
                print(f"  + Added Category: [{cat_data['department']}] {category.name}")
            else:
                category.name = cat_data["category"]
                category.slug = cat_data["slug"]
                category.department = cat_data["department"]
                category.display_order = cat_data["display_order"]
                category.is_active = True
                await session.flush()
            
            total_categories += 1

            # Upsert Services in this category
            svc_order = 10
            for s_info in cat_data["services"]:
                svc_order += 5
                v_name = s_info.get("variant")
                s_name = s_info["name"]
                
                # Compose slug
                if v_name:
                    item_slug = slugify(f"{cat_data['slug']}-{s_name}-{v_name}")
                else:
                    item_slug = slugify(f"{cat_data['slug']}-{s_name}")

                # Query existing service
                svc_stmt = select(Service).where(
                    Service.business_id == biz.id,
                    Service.category_id == category.id,
                    Service.name == s_name,
                    Service.variant_name == v_name
                )
                svc_res = await session.execute(svc_stmt)
                service = svc_res.scalar_one_or_none()

                if not service:
                    # Fallback check by slug
                    svc_stmt2 = select(Service).where(
                        Service.business_id == biz.id,
                        Service.slug == item_slug
                    )
                    svc_res2 = await session.execute(svc_stmt2)
                    service = svc_res2.scalar_one_or_none()

                if not service:
                    service = Service(
                        business_id=biz.id,
                        category_id=category.id,
                        name=s_name,
                        slug=item_slug,
                        variant_name=v_name,
                        price=s_info["price"],
                        duration_minutes=s_info["duration"],
                        audience=s_info["audience"],
                        is_variable_price=s_info.get("is_variable_price", False),
                        combo_items=s_info.get("combo_items"),
                        display_order=svc_order,
                        is_active=True
                    )
                    session.add(service)
                    total_services += 1
                else:
                    # Update fields to match official menu
                    service.category_id = category.id
                    service.slug = item_slug
                    service.price = s_info["price"]
                    service.duration_minutes = s_info["duration"]
                    service.audience = s_info["audience"]
                    service.is_variable_price = s_info.get("is_variable_price", False)
                    service.combo_items = s_info.get("combo_items")
                    service.display_order = svc_order
                    service.is_active = True
                    total_services += 1

        await session.commit()
        print(f"\nSuccessfully imported catalog!")
        print(f"Total Categories: {total_categories}")
        print(f"Total Services: {total_services}")
        return True

if __name__ == "__main__":
    b_id = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(import_catalogue(b_id))
