"""JWT auth manager + Flask decorators."""
import hashlib
import logging
import secrets
from datetime import datetime, timedelta
from functools import wraps
from typing import Optional

import jwt
from flask import current_app, jsonify, request

from backend import config

logger = logging.getLogger(__name__)


class AuthManager:
    _ALGORITHM = "HS256"

    def __init__(self, user_model):
        self._user = user_model

    def issue_access(self, user_id: int, email: str) -> str:
        return jwt.encode(
            {
                "user_id": user_id,
                "email": email,
                "type": "access",
                "exp": datetime.utcnow() + timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES),
                "iat": datetime.utcnow(),
            },
            config.SECRET_KEY,
            algorithm=self._ALGORITHM,
        )

    def issue_refresh(self, user_id: int) -> str:
        token = secrets.token_urlsafe(64)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        expires = datetime.utcnow() + timedelta(days=config.REFRESH_TOKEN_EXPIRE_DAYS)
        self._user.save_token(user_id, token_hash, expires)
        return token

    def verify_access(self, token: str) -> Optional[dict]:
        try:
            payload = jwt.decode(token, config.SECRET_KEY, algorithms=[self._ALGORITHM])
            if payload.get("type") != "access":
                return None
            return {"user_id": payload["user_id"], "email": payload["email"]}
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

    def refresh(self, refresh_token: str) -> Optional[dict]:
        token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
        user_id = self._user.verify_token(token_hash)
        if not user_id:
            return None
        user = self._user.by_id(user_id)
        if not user or not user["is_active"]:
            return None
        return {"access_token": self.issue_access(user_id, user["email"]), "user": user}

    def revoke_all(self, user_id: int) -> None:
        self._user.delete_all_tokens(user_id)


def _get_auth() -> AuthManager:
    return current_app.config["AUTH_MANAGER"]


def token_required(f):
    @wraps(f)
    def inner(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        parts = header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Authentication token is missing"}), 401
        payload = _get_auth().verify_access(parts[1])
        if not payload:
            return jsonify({"error": "Invalid or expired token"}), 401
        return f(current_user=payload, *args, **kwargs)
    return inner


def optional_token(f):
    @wraps(f)
    def inner(*args, **kwargs):
        current_user = None
        header = request.headers.get("Authorization", "")
        parts = header.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            current_user = _get_auth().verify_access(parts[1])
        return f(current_user=current_user, *args, **kwargs)
    return inner
