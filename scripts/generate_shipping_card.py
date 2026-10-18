#!/usr/bin/env python3
"""Regenerate print-ready shipping cards from the vector SVG masters.

Run: python -m pip install cairosvg pypdf pillow
     python scripts/generate_shipping_card.py
"""
from __future__ import annotations

from io import BytesIO
import base64
from pathlib import Path
import re
from zipfile import ZIP_DEFLATED, ZipFile

import cairosvg
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject

ROOT = Path(__file__).resolve().parents[1]
CARDS = ROOT / "ressources" / "cartes-expedition"
MM_TO_PT = 72 / 25.4
FINISHED_WIDTH_MM = 85
FINISHED_HEIGHT_MM = 55
BLEED_MM = 3


def load_svg(face: str) -> bytes:
    """Resolve the optional raster train image for portable print rendering."""
    source = (CARDS / f"minitrainstore-{face}.svg").read_bytes()
    if face == "recto":
        image_href = b'href="assets/train-recto.jpg"'
        if image_href not in source:
            raise ValueError("Expected raster train asset reference missing")
        jpg = (CARDS / "assets" / "train-recto.jpg").read_bytes()
        encoded = base64.b64encode(jpg)
        source = source.replace(image_href, b'href="data:image/jpeg;base64,' + encoded + b'"')
    return source


def write_standalone() -> None:
    """Standalone SVG is usable without checking out or copying assets."""
    (CARDS / "minitrainstore-recto-standalone.svg").write_bytes(load_svg("recto"))


def svg_with_bleed(svg: bytes) -> bytes:
    """Expose the existing 3 mm bleed outside the finished SVG viewBox."""
    opening_tag = (
        '<svg xmlns="http://www.w3.org/2000/svg" '
        'width="91mm" height="61mm" viewBox="-3 -3 91 61">'
    )
    updated, count = re.subn(rb"<svg\b[^>]*>", opening_tag.encode(), svg, count=1)
    if count != 1:
        raise ValueError("SVG opening tag not found")
    return updated


def write_pdf() -> None:
    writer = PdfWriter()
    for face in ("recto", "verso"):
        pdf_page = cairosvg.svg2pdf(bytestring=svg_with_bleed(load_svg(face)))
        page = PdfReader(BytesIO(pdf_page)).pages[0]
        page.trimbox = RectangleObject(
            [
                BLEED_MM * MM_TO_PT,
                BLEED_MM * MM_TO_PT,
                (BLEED_MM + FINISHED_WIDTH_MM) * MM_TO_PT,
                (BLEED_MM + FINISHED_HEIGHT_MM) * MM_TO_PT,
            ]
        )
        writer.add_page(page)
    with (CARDS / "minitrainstore-impression.pdf").open("wb") as fp:
        writer.write(fp)


def write_preview() -> None:
    width, height, margin, gap, header = 1020, 660, 40, 50, 75
    canvas = Image.new(
        "RGB", (2 * width + gap + 2 * margin, height + header + margin), "#e6e9eb"
    )
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 27)
    except OSError:
        font = ImageFont.load_default()

    for i, (face, label) in enumerate(
        [("recto", "RECTO — Boutique & QR code"), ("verso", "VERSO — Message manuscrit")]
    ):
        x = margin + i * (width + gap)
        y = header
        png = cairosvg.svg2png(
            bytestring=load_svg(face), output_width=width, output_height=height
        )
        card = Image.open(BytesIO(png)).convert("RGB")
        canvas.paste(card, (x, y))
        draw.rectangle([x, y, x + width - 1, y + height - 1], outline="#b6c2ca", width=2)
        draw.text((x, 23), label, fill="#133a57", font=font)

    canvas.save(CARDS / "minitrainstore-apercu.png", optimize=True)


def write_zip() -> None:
    files = [
        "minitrainstore-recto.svg",
        "minitrainstore-recto-standalone.svg",
        "assets/train-recto.jpg",
        "minitrainstore-verso.svg",
        "sources-editables/minitrainstore-recto.svg",
        "sources-editables/minitrainstore-verso.svg",
        "minitrainstore-impression.pdf",
        "minitrainstore-apercu.png",
        "README.md",
        "LIRE-AVANT-IMPRESSION.txt",
    ]
    with ZipFile(CARDS / "minitrainstore-kit-carte.zip", "w", ZIP_DEFLATED) as archive:
        for relative_path in files:
            archive.write(CARDS / relative_path, relative_path)


if __name__ == "__main__":
    write_standalone()
    write_pdf()
    write_preview()
    write_zip()
    print("Created shipping card: two-page PDF, preview PNG and complete ZIP.")
