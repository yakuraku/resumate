"""JWT, bcrypt, and CSRF helpers. Pure functions, no DB access."""
from datetime import datetime, timedelta, timezone
from typing import Optional
import hmac
import hashlib
import secrets

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.config import settings


_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd_context.verify(plain, hashed)
    except Exception:
        return False


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        return user_id if isinstance(user_id, str) else None
    except JWTError:
        return None


def make_csrf_token(user_id: str) -> str:
    """HMAC(user_id + random nonce). Stateless, stable per session."""
    nonce = secrets.token_hex(16)
    sig = hmac.new(
        settings.CSRF_SECRET_KEY.encode(),
        f"{user_id}.{nonce}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return f"{nonce}.{sig}"


def verify_csrf_token(token: str, user_id: str) -> bool:
    if not token or "." not in token:
        return False
    try:
        nonce, sig = token.split(".", 1)
    except ValueError:
        return False
    expected = hmac.new(
        settings.CSRF_SECRET_KEY.encode(),
        f"{user_id}.{nonce}".encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(sig, expected)
