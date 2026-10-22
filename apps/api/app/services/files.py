"""Uploaded files live on disk under ITHRAA_UPLOAD_DIR; the DB stores relative paths."""
import secrets
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import get_settings

MAX_BYTES = 20 * 1024 * 1024
ALLOWED = {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".doc", ".docx", ".ppt", ".pptx", ".txt", ".mp4",
           ".zip", ".py", ".html"}


def kind_for(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return "PDF"
    if ext in (".mp4",):
        return "VID"
    if ext in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
        return "IMG"
    return "DOC"


async def save_upload(file: UploadFile, folder: str) -> tuple[str, int]:
    """Store an upload; returns (relative path, size in bytes)."""
    name = Path(file.filename or "upload").name
    if Path(name).suffix.lower() not in ALLOWED:
        raise HTTPException(400, "This file type isn’t supported. Use PDF, an image, a document or a video.")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(400, "Files can be up to 20 MB")
    rel = Path(folder) / f"{secrets.token_hex(6)}_{name}"
    path = get_settings().upload_dir / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return rel.as_posix(), len(data)


def absolute(rel: str) -> Path:
    root = get_settings().upload_dir.resolve()
    path = (root / rel).resolve()
    if root not in path.parents:
        raise HTTPException(404, "File not found")
    return path


def size_label(n: int | None) -> str:
    if not n:
        return ""
    return f"{n / 1024 / 1024:.1f} MB" if n >= 1024 * 1024 else f"{max(1, n // 1024)} KB"
