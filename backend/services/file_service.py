from pathlib import Path

# File types we can read as plain text
TEXT_EXTENSIONS = {
    ".txt", ".md", ".py", ".js", ".ts", ".jsx", ".tsx",
    ".json", ".csv", ".html", ".xml", ".yaml", ".yml",
    ".sh", ".bash", ".css", ".sql", ".rst", ".log",
    ".toml", ".ini", ".cfg", ".rb", ".go", ".java",
    ".c", ".cpp", ".h", ".rs", ".swift", ".kt",
}

MAX_FILE_BYTES = 20 * 1024 * 1024   # 20 MB hard limit
MAX_INJECT_CHARS = 16_000            # chars sent to the model (~4k tokens)


def extract_text(filename: str, content: bytes) -> tuple[str, bool]:
    """
    Extract plain text from file bytes.
    Returns (text, was_truncated).
    Raises ValueError for unsupported types.
    """
    if len(content) > MAX_FILE_BYTES:
        raise ValueError(f"File exceeds the 20 MB limit.")

    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        text = _extract_pdf(content)
    elif ext in TEXT_EXTENSIONS or _looks_like_text(content):
        text = _decode(content)
    else:
        raise ValueError(
            f"Unsupported file type '{ext}'. "
            "Supported: PDF, plain text, Markdown, code files (py, js, ts, etc.), CSV, JSON, YAML."
        )

    truncated = len(text) > MAX_INJECT_CHARS
    return text[:MAX_INJECT_CHARS], truncated


def _extract_pdf(content: bytes) -> str:
    import fitz  # PyMuPDF
    doc = fitz.open(stream=content, filetype="pdf")
    pages = [page.get_text() for page in doc]
    return "\n".join(pages).strip()


def _decode(content: bytes) -> str:
    for enc in ("utf-8", "utf-16", "latin-1"):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    return content.decode("utf-8", errors="replace")


def _looks_like_text(content: bytes) -> bool:
    sample = content[:2048]
    try:
        sample.decode("utf-8")
        return True
    except UnicodeDecodeError:
        return False
