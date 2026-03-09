import json
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from app.utils.filesystem import get_data_dir, get_context_folder

router = APIRouter()

CONFIG_PATH = get_data_dir() / "context_config.json"


# ---------- helpers ----------

def _validate_filename(filename: str) -> None:
    """Raise 400 if filename is unsafe or not .md"""
    if not filename.endswith(".md"):
        raise HTTPException(status_code=400, detail="Filename must end with .md")
    if any(c in filename for c in ("..", "/", "\\")):
        raise HTTPException(status_code=400, detail="Filename contains invalid characters")


def _safe_path(filename: str) -> Path:
    """Return absolute path inside the context folder; raise 400 on traversal."""
    _validate_filename(filename)
    folder = get_context_folder()
    resolved = (folder / filename).resolve()
    if not str(resolved).startswith(str(folder.resolve())):
        raise HTTPException(status_code=400, detail="Path traversal detected")
    return resolved


# ---------- schemas ----------

class ConfigResponse(BaseModel):
    folder_path: str


class ConfigUpdate(BaseModel):
    folder_path: str


class FileInfo(BaseModel):
    filename: str
    size_bytes: int
    modified_at: str
    preview: str


class FileContent(BaseModel):
    filename: str
    content: str
    modified_at: str


class FileCreate(BaseModel):
    filename: str
    content: str


class FileUpdate(BaseModel):
    content: str


# ---------- config endpoints ----------

@router.get("/config", response_model=ConfigResponse)
async def get_config():
    folder = get_context_folder()
    return ConfigResponse(folder_path=str(folder))


@router.put("/config", response_model=ConfigResponse)
async def update_config(body: ConfigUpdate):
    folder = Path(body.folder_path)
    if not folder.is_absolute():
        raise HTTPException(status_code=400, detail="folder_path must be an absolute path")
    if not folder.exists():
        raise HTTPException(status_code=400, detail="Folder does not exist")
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps({"folder_path": str(folder)}), encoding="utf-8")
    return ConfigResponse(folder_path=str(folder))


# ---------- file CRUD ----------

@router.get("/", response_model=List[FileInfo])
async def list_files():
    folder = get_context_folder()
    if not folder.exists():
        return []
    files = []
    for p in sorted(folder.glob("*.md")):
        stat = p.stat()
        content = p.read_text(encoding="utf-8", errors="replace")
        files.append(FileInfo(
            filename=p.name,
            size_bytes=stat.st_size,
            modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            preview=content[:150],
        ))
    return files


@router.get("/{filename}", response_model=FileContent)
async def get_file(filename: str):
    path = _safe_path(filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    stat = path.stat()
    return FileContent(
        filename=filename,
        content=path.read_text(encoding="utf-8", errors="replace"),
        modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
    )


@router.post("/", response_model=FileContent, status_code=201)
async def create_file(body: FileCreate):
    path = _safe_path(body.filename)
    if path.exists():
        raise HTTPException(status_code=409, detail="File already exists")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body.content, encoding="utf-8")
    stat = path.stat()
    return FileContent(
        filename=body.filename,
        content=body.content,
        modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
    )


@router.put("/{filename}", response_model=FileContent)
async def update_file(filename: str, body: FileUpdate):
    path = _safe_path(filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    path.write_text(body.content, encoding="utf-8")
    stat = path.stat()
    return FileContent(
        filename=filename,
        content=body.content,
        modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
    )


@router.delete("/{filename}")
async def delete_file(filename: str):
    path = _safe_path(filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    path.unlink()
    return {"status": "success"}


@router.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    folder = get_context_folder()
    folder.mkdir(parents=True, exist_ok=True)
    results = []
    for upload in files:
        name = upload.filename or ""
        if not name.endswith(".md") or any(c in name for c in ("..", "/", "\\")):
            results.append({"filename": name, "status": "skipped", "reason": "invalid filename"})
            continue
        dest = folder / name
        if dest.exists():
            results.append({"filename": name, "status": "skipped", "reason": "already exists"})
            continue
        content = await upload.read()
        dest.write_bytes(content)
        results.append({"filename": name, "status": "created"})
    return {"results": results}


# ---------- AI ingest ----------

class IngestRequest(BaseModel):
    text: str
    filename: str | None = None


@router.post("/ingest", status_code=201)
async def ingest_to_file(body: IngestRequest):
    """Extract structured context via LLM and save as a .md file."""
    from app.services.llm_service import llm_service
    from app.services.prompts import (
        CONTEXT_EXTRACTION_SYSTEM_PROMPT,
        CONTEXT_EXTRACTION_USER_PROMPT_TEMPLATE,
    )
    import json as _json
    from datetime import datetime as _dt

    if not body.text or len(body.text.strip()) < 10:
        raise HTTPException(status_code=400, detail="Input text too short")

    user_prompt = CONTEXT_EXTRACTION_USER_PROMPT_TEMPLATE.format(input_text=body.text[:5000])
    messages = [
        {"role": "system", "content": CONTEXT_EXTRACTION_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
    response_json = await llm_service.get_completion(messages, json_mode=True)

    clean = response_json.strip()
    for prefix in ("```json", "```"):
        if clean.startswith(prefix):
            clean = clean[len(prefix):]
    if clean.endswith("```"):
        clean = clean[:-3]

    try:
        data = _json.loads(clean)
        items = data.get("items", [])
    except _json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse LLM response")

    # Build markdown content
    lines = []
    for item in items:
        key = item.get("key", "")
        value = item.get("value", "")
        category = item.get("category", "general")
        if key and value:
            lines.append(f"## {key}\n**Category:** {category}\n\n{value}\n")

    md_content = "\n---\n\n".join(lines) if lines else "No context extracted."
    timestamp = _dt.now().strftime("%Y%m%d_%H%M%S")
    filename = body.filename or f"ingest-{timestamp}.md"
    if not filename.endswith(".md"):
        filename += ".md"

    path = _safe_path(filename)
    if path.exists():
        # Append with separator
        existing = path.read_text(encoding="utf-8")
        path.write_text(existing + f"\n\n---\n\n{md_content}", encoding="utf-8")
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(md_content, encoding="utf-8")

    stat = path.stat()
    return FileContent(
        filename=filename,
        content=path.read_text(encoding="utf-8"),
        modified_at=datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
    )
