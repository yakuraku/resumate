"""Fernet symmetric encryption for at-rest secrets (user-provided API keys).

Encrypted values are prefixed with 'enc::' so we can detect plaintext migrations
and rotate keys safely.
"""
from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


_PREFIX = "enc::"
_fernet: Fernet | None = None


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        key = settings.ENCRYPTION_KEY
        if not key:
            raise RuntimeError(
                "ENCRYPTION_KEY is not set. Generate one with: "
                "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet


def encrypt(plain: str) -> str:
    if not plain:
        return plain
    token = _get_fernet().encrypt(plain.encode()).decode()
    return f"{_PREFIX}{token}"


def decrypt(value: str) -> str:
    if not value or not value.startswith(_PREFIX):
        return value  # plaintext or empty; return as-is
    token = value[len(_PREFIX):]
    try:
        return _get_fernet().decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Failed to decrypt value: wrong ENCRYPTION_KEY?") from exc


def is_encrypted(value: str) -> bool:
    return isinstance(value, str) and value.startswith(_PREFIX)
