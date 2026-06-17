# backend/ml_models/certificate_verifier.py
"""
OCR-based coach certificate verifier.
Uses pytesseract to extract text from uploaded certificate images/PDFs
and checks for known sports authority keywords.
Falls back gracefully if OCR is not installed.
"""

import re
import os

# Known Indian sports bodies and coaching qualifications
SPORTS_AUTHORITY_KEYWORDS = [
    # Indian sports bodies
    "SAI", "Sports Authority of India",
    "NIS", "NIS Patiala", "National Institute of Sports",
    "NSNIS", "National Sports Federation",
    "IOA", "Indian Olympic Association",
    "BCCI", "AIFF", "Hockey India", "Athletics Federation",
    "SAG", "Sports Authority of Gujarat",
    # Certification keywords
    "Coach", "Coaching Certificate", "Coaching Diploma",
    "Trainer", "Physical Education", "Sports Science",
    "Level 1", "Level 2", "Level 3", "Level A", "Level B", "Level C",
    "AFC", "AIFF D-License", "AIFF C-License",
    "NSCA", "CSCS", "CPT", "Certified Personal Trainer",
    "Diploma in Sports Coaching",
    "Bachelor of Physical Education", "BPEd", "MPEd",
    # International bodies
    "FIFA", "FIBA", "World Athletics", "BWF",
    "ITF", "WTA", "ATP", "ICC", "FIDE",
]

ROLE_KEYWORDS = [
    "coach", "trainer", "instructor", "mentor",
    "physical education", "sports science", "athletics",
    "certified", "diploma", "license", "licence",
]


def verify_certificate(file_path: str) -> dict:
    """
    Analyse a certificate file and return a verification result.

    Returns:
        dict with keys:
            - verified: bool
            - confidence: float (0-1)
            - reason: str
            - keywords_found: list[str]
    """
    if not os.path.exists(file_path):
        return {
            "verified": False,
            "confidence": 0.0,
            "reason": "Certificate file not found",
            "keywords_found": [],
        }

    ext = file_path.lower().split(".")[-1]

    # Extract text
    text = _extract_text(file_path, ext)

    if not text or len(text.strip()) < 20:
        # Could not read text — soft approve with manual review flag
        return {
            "verified": None,  # Needs manual review
            "confidence": 0.3,
            "reason": "Could not extract text from certificate. Flagged for manual review.",
            "keywords_found": [],
        }

    return _analyse_text(text)


def _extract_text(file_path: str, ext: str) -> str:
    """Extract text from image or PDF."""
    text = ""
    try:
        import pytesseract
        from PIL import Image

        if ext in ("jpg", "jpeg", "png", "bmp", "tiff", "webp"):
            img = Image.open(file_path)
            text = pytesseract.image_to_string(img)

        elif ext == "pdf":
            try:
                import fitz  # PyMuPDF
                doc = fitz.open(file_path)
                for page in doc:
                    text += page.get_text()
                doc.close()
            except ImportError:
                # Try converting PDF page to image
                try:
                    from pdf2image import convert_from_path
                    images = convert_from_path(file_path, first_page=1, last_page=2)
                    for img in images:
                        text += pytesseract.image_to_string(img)
                except ImportError:
                    text = ""

    except ImportError:
        print("[CertVerify] pytesseract not installed — skipping OCR, using filename only")
        text = os.path.basename(file_path)  # fallback: just the filename

    except Exception as e:
        print(f"[CertVerify] Error extracting text: {e}")

    return text


def _analyse_text(text: str) -> dict:
    """Score the extracted text for certificate validity."""
    text_lower = text.lower()
    keywords_found = []
    score = 0.0

    # Check sports authority keywords
    for kw in SPORTS_AUTHORITY_KEYWORDS:
        if kw.lower() in text_lower:
            keywords_found.append(kw)
            score += 0.15

    # Check role keywords
    for kw in ROLE_KEYWORDS:
        if kw in text_lower:
            if kw not in keywords_found:
                keywords_found.append(kw)
            score += 0.10

    # Check for dates (indicates official document)
    if re.search(r"\b(19|20)\d{2}\b", text):
        score += 0.10

    # Check for name-like patterns
    if re.search(r"[A-Z][a-z]+ [A-Z][a-z]+", text):
        score += 0.05

    # Clamp score
    confidence = min(score, 1.0)

    if confidence >= 0.35:
        return {
            "verified": True,
            "confidence": round(confidence, 2),
            "reason": f"Certificate appears valid. Keywords found: {', '.join(keywords_found[:5])}",
            "keywords_found": keywords_found,
        }
    elif confidence >= 0.15:
        return {
            "verified": None,  # Borderline — manual review
            "confidence": round(confidence, 2),
            "reason": "Certificate is borderline. Flagged for manual review.",
            "keywords_found": keywords_found,
        }
    else:
        return {
            "verified": False,
            "confidence": round(confidence, 2),
            "reason": "Certificate does not appear to be from a recognised sports authority.",
            "keywords_found": keywords_found,
        }
