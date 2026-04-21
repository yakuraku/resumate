"""User-scoped binary storage for PDFs.

Two backends:
  - LocalBinaryStorage: files under data/users/{user_id}/pdfs/{key}. Used in
    self-host mode. Returns a local path for FileResponse; url() returns None.
  - R2BinaryStorage: Cloudflare R2 via boto3 (S3-compatible). url() returns a
    presigned GET URL; local_path() returns None. The resume route issues a
    302 redirect to the presigned URL.

Keys are relative paths rooted at the user namespace -- e.g. "pdfs/resume_<id>.pdf".
Callers never handle absolute paths.

The concrete instance is created once at app startup (main.py lifespan) based
on settings.STORAGE_BACKEND and exposed via get_binary_storage().
"""
from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from app.config import settings


class BinaryStorageService(ABC):
    @abstractmethod
    async def put(self, user_id: str, key: str, data: bytes) -> None: ...

    @abstractmethod
    async def get(self, user_id: str, key: str) -> bytes: ...

    @abstractmethod
    async def delete(self, user_id: str, key: str) -> None: ...

    @abstractmethod
    async def exists(self, user_id: str, key: str) -> bool: ...

    @abstractmethod
    async def url(self, user_id: str, key: str, expires_in: int = 3600) -> Optional[str]:
        """Presigned GET URL (R2). None for local (caller uses FileResponse)."""

    @abstractmethod
    def local_path(self, user_id: str, key: str) -> Optional[Path]:
        """Absolute path on disk (local mode). None for R2."""

    @abstractmethod
    async def list_keys(self, user_id: str, prefix: str = "") -> list[str]:
        """List user-scoped keys under a prefix (e.g. "pdfs/"). Used for cleanup."""


def _safe_key(key: str) -> str:
    """Reject traversal. Keys are relative and must not escape the user namespace."""
    if not key or ".." in key.split("/") or ".." in key.split("\\"):
        raise ValueError(f"Invalid storage key: {key!r}")
    # Normalize backslashes (Windows callers) to forward slashes.
    return key.replace("\\", "/").lstrip("/")


class LocalBinaryStorage(BinaryStorageService):
    def __init__(self, root: Path):
        self._root = root

    def _path(self, user_id: str, key: str) -> Path:
        key = _safe_key(key)
        return self._root / user_id / key

    async def put(self, user_id: str, key: str, data: bytes) -> None:
        path = self._path(user_id, key)
        path.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(path.write_bytes, data)

    async def get(self, user_id: str, key: str) -> bytes:
        path = self._path(user_id, key)
        return await asyncio.to_thread(path.read_bytes)

    async def delete(self, user_id: str, key: str) -> None:
        path = self._path(user_id, key)
        await asyncio.to_thread(lambda: path.unlink(missing_ok=True))

    async def exists(self, user_id: str, key: str) -> bool:
        return await asyncio.to_thread(self._path(user_id, key).exists)

    async def url(self, user_id: str, key: str, expires_in: int = 3600) -> Optional[str]:
        return None  # local mode streams via FileResponse

    def local_path(self, user_id: str, key: str) -> Optional[Path]:
        return self._path(user_id, key)

    async def list_keys(self, user_id: str, prefix: str = "") -> list[str]:
        base = self._root / user_id
        if not base.exists():
            return []
        def _walk() -> list[str]:
            out: list[str] = []
            start = base / prefix if prefix else base
            if not start.exists():
                return out
            for p in start.rglob("*"):
                if p.is_file():
                    out.append(str(p.relative_to(base)).replace("\\", "/"))
            return out
        return await asyncio.to_thread(_walk)


class R2BinaryStorage(BinaryStorageService):
    """Cloudflare R2 via boto3 S3 client.

    boto3 is imported lazily so the dependency is only required when this
    backend is actually selected (cloud deploys). Local/self-host installs
    never need it.
    """

    def __init__(
        self,
        bucket: str,
        endpoint_url: str,
        access_key_id: str,
        secret_access_key: str,
    ):
        try:
            import boto3  # noqa: F401
            from botocore.config import Config  # noqa: F401
        except ImportError as e:
            raise RuntimeError(
                "STORAGE_BACKEND=r2 requires boto3. Install with: pip install boto3"
            ) from e

        import boto3
        from botocore.config import Config

        self._bucket = bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=Config(signature_version="s3v4"),
        )

    def _key(self, user_id: str, key: str) -> str:
        return f"users/{user_id}/{_safe_key(key)}"

    async def put(self, user_id: str, key: str, data: bytes) -> None:
        await asyncio.to_thread(
            self._client.put_object,
            Bucket=self._bucket,
            Key=self._key(user_id, key),
            Body=data,
        )

    async def get(self, user_id: str, key: str) -> bytes:
        def _read() -> bytes:
            obj = self._client.get_object(Bucket=self._bucket, Key=self._key(user_id, key))
            return obj["Body"].read()
        return await asyncio.to_thread(_read)

    async def delete(self, user_id: str, key: str) -> None:
        await asyncio.to_thread(
            self._client.delete_object, Bucket=self._bucket, Key=self._key(user_id, key)
        )

    async def exists(self, user_id: str, key: str) -> bool:
        def _head() -> bool:
            try:
                self._client.head_object(Bucket=self._bucket, Key=self._key(user_id, key))
                return True
            except Exception:
                return False
        return await asyncio.to_thread(_head)

    async def url(self, user_id: str, key: str, expires_in: int = 3600) -> Optional[str]:
        return await asyncio.to_thread(
            self._client.generate_presigned_url,
            "get_object",
            Params={"Bucket": self._bucket, "Key": self._key(user_id, key)},
            ExpiresIn=expires_in,
        )

    def local_path(self, user_id: str, key: str) -> Optional[Path]:
        return None

    async def list_keys(self, user_id: str, prefix: str = "") -> list[str]:
        full_prefix = f"users/{user_id}/{_safe_key(prefix)}" if prefix else f"users/{user_id}/"
        user_prefix_len = len(f"users/{user_id}/")
        def _list() -> list[str]:
            paginator = self._client.get_paginator("list_objects_v2")
            keys: list[str] = []
            for page in paginator.paginate(Bucket=self._bucket, Prefix=full_prefix):
                for obj in page.get("Contents", []) or []:
                    k = obj["Key"]
                    if k.startswith(full_prefix):
                        keys.append(k[user_prefix_len:])
            return keys
        return await asyncio.to_thread(_list)


# ---------- module-level instance ----------

_instance: Optional[BinaryStorageService] = None


def get_binary_storage() -> BinaryStorageService:
    global _instance
    if _instance is not None:
        return _instance
    if settings.STORAGE_BACKEND == "r2":
        missing = [
            name for name, val in [
                ("R2_BUCKET_NAME", settings.R2_BUCKET_NAME),
                ("R2_ENDPOINT_URL", settings.R2_ENDPOINT_URL),
                ("R2_ACCESS_KEY_ID", settings.R2_ACCESS_KEY_ID),
                ("R2_SECRET_ACCESS_KEY", settings.R2_SECRET_ACCESS_KEY),
            ]
            if not val
        ]
        if missing:
            raise RuntimeError(f"STORAGE_BACKEND=r2 but missing env vars: {', '.join(missing)}")
        _instance = R2BinaryStorage(
            bucket=settings.R2_BUCKET_NAME,
            endpoint_url=settings.R2_ENDPOINT_URL,
            access_key_id=settings.R2_ACCESS_KEY_ID,
            secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        )
    else:
        from app.utils.filesystem import get_data_dir
        _instance = LocalBinaryStorage(root=get_data_dir() / "users")
    return _instance
