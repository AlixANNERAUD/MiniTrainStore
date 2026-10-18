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
from pypdf import PdfReader, PdfWriter, Transformation
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



# A4 imposed sheets: 2 columns x 4 rows, with independent 3 mm bleed per card.
A4_WIDTH_MM = 210
A4_HEIGHT_MM = 297
A4_COLUMNS = 2
A4_ROWS = 4
SLOT_WIDTH_MM = FINISHED_WIDTH_MM + 2 * BLEED_MM
SLOT_HEIGHT_MM = FINISHED_HEIGHT_MM + 2 * BLEED_MM


def _a4_geometry() -> tuple[float, float]:
    margin_x = (A4_WIDTH_MM - A4_COLUMNS * SLOT_WIDTH_MM) / 2
    margin_y = (A4_HEIGHT_MM - A4_ROWS * SLOT_HEIGHT_MM) / 2
    if margin_x < 0 or margin_y < 0:
        raise ValueError("Card imposes outside an A4 sheet")
    return margin_x, margin_y


def _crop_mark_segments() -> list[tuple[float, float, float, float]]:
    """Crop marks stay entirely outside the 85 x 55 mm finished cards."""
    margin_x, margin_y = _a4_geometry()
    segments = []
    for row in range(A4_ROWS):
        for column in range(A4_COLUMNS):
            left = margin_x + column * SLOT_WIDTH_MM + BLEED_MM
            top = margin_y + row * SLOT_HEIGHT_MM + BLEED_MM
            for x in (left, left + FINISHED_WIDTH_MM):
                for y in (top, top + FINISHED_HEIGHT_MM):
                    outside_y = (y - 2.35, y - 0.6) if y == top else (y + 0.6, y + 2.35)
                    outside_x = (x - 2.35, x - 0.6) if x == left else (x + 0.6, x + 2.35)
                    segments.append((x, outside_y[0], x, outside_y[1]))
                    segments.append((outside_x[0], y, outside_x[1], y))
    return segments


def _crop_marks_pdf_page():
    paths = " ".join(
        f"M{x1:g} {y1:g}L{x2:g} {y2:g}"
        for x1, y1, x2, y2 in _crop_mark_segments()
    )
    overlay = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" '
        'viewBox="0 0 210 297"><path d="' + paths +
        '" fill="none" stroke="#485563" stroke-width="0.17"/></svg>'
    )
    return PdfReader(BytesIO(cairosvg.svg2pdf(bytestring=overlay.encode()))).pages[0]


def write_a4_sheet() -> None:
    """Two A4 portrait pages, eight cards on each, ready for long-edge duplex."""
    single_cards = PdfReader(CARDS / "minitrainstore-impression.pdf")
    if len(single_cards.pages) != 2:
        raise ValueError("Expected single-card PDF with recto and verso")
    margin_x, margin_y = _a4_geometry()
    writer = PdfWriter()
    marks = _crop_marks_pdf_page()
    for source in single_cards.pages:
        sheet = writer.add_blank_page(
            width=A4_WIDTH_MM * MM_TO_PT,
            height=A4_HEIGHT_MM * MM_TO_PT,
        )
        for row in range(A4_ROWS):
            for column in range(A4_COLUMNS):
                x_mm = margin_x + column * SLOT_WIDTH_MM
                y_mm = A4_HEIGHT_MM - (margin_y + (row + 1) * SLOT_HEIGHT_MM)
                sheet.merge_transformed_page(
                    source,
                    Transformation().translate(x_mm * MM_TO_PT, y_mm * MM_TO_PT),
                )
        sheet.merge_page(marks)
    target = CARDS / "minitrainstore-planche-A4.pdf"
    with target.open("wb") as fp:
        writer.write(fp)
    verify = PdfReader(target)
    if len(verify.pages) != 2:
        raise AssertionError("The A4 print sheet must have two sides")
    for page in verify.pages:
        if (abs(float(page.mediabox.width) - A4_WIDTH_MM * MM_TO_PT) > 0.1
                or abs(float(page.mediabox.height) - A4_HEIGHT_MM * MM_TO_PT) > 0.1):
            raise AssertionError("The print sheet is not A4")


def write_a4_preview() -> None:
    """Side-by-side preview of the two imposed pages (not for printing)."""
    pixels_per_mm = 3
    page_w = A4_WIDTH_MM * pixels_per_mm
    page_h = A4_HEIGHT_MM * pixels_per_mm
    outer = 20
    gap = 32
    top = 40
    preview = Image.new(
        "RGB", (page_w * 2 + gap + outer * 2, page_h + top + outer),
        "#e7ebee",
    )
    draw = ImageDraw.Draw(preview)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 21)
    except OSError:
        font = ImageFont.load_default()
    margin_x, margin_y = _a4_geometry()
    for face_index, face in enumerate(("recto", "verso")):
        offset_x = outer + face_index * (page_w + gap)
        offset_y = top
        draw.rectangle(
            (offset_x, offset_y, offset_x + page_w, offset_y + page_h),
            fill="white",
        )
        draw.text(
            (offset_x + 2, 8),
            "RECTO - 8 cartes" if face_index == 0 else "VERSO - 8 cartes",
            font=font, fill="#133a57",
        )
        img = Image.open(BytesIO(cairosvg.svg2png(
            bytestring=svg_with_bleed(load_svg(face)),
            output_width=int(SLOT_WIDTH_MM * pixels_per_mm),
            output_height=int(SLOT_HEIGHT_MM * pixels_per_mm),
        ))).convert("RGB")
        for row in range(A4_ROWS):
            for column in range(A4_COLUMNS):
                x = offset_x + round((margin_x + column * SLOT_WIDTH_MM) * pixels_per_mm)
                y = offset_y + round((margin_y + row * SLOT_HEIGHT_MM) * pixels_per_mm)
                preview.paste(img, (x, y))
        for x1, y1, x2, y2 in _crop_mark_segments():
            draw.line(
                (offset_x + round(x1 * pixels_per_mm),
                 offset_y + round(y1 * pixels_per_mm),
                 offset_x + round(x2 * pixels_per_mm),
                 offset_y + round(y2 * pixels_per_mm)),
                fill="#485563", width=1,
            )
    preview.save(CARDS / "minitrainstore-planche-A4-apercu.png", optimize=True)

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
        "minitrainstore-planche-A4.pdf",
        "minitrainstore-planche-A4-apercu.png",
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
    write_a4_sheet()
    write_a4_preview()
    write_preview()
    write_zip()
    print("Created shipping card, eight-up A4 duplex sheet, previews and ZIP.")
