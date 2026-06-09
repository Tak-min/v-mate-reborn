"""Google OAuth 2.0 integration."""
import logging

from authlib.integrations.flask_client import OAuth
from flask import url_for

from backend import config

logger = logging.getLogger(__name__)


class OAuthManager:
    def __init__(self, app, user_model, auth_manager):
        self._user = user_model
        self._auth = auth_manager
        self._oauth = OAuth(app)
        self._google = None
        self._setup_google()

    def _setup_google(self) -> None:
        if not config.GOOGLE_CLIENT_ID or not config.GOOGLE_CLIENT_SECRET:
            logger.warning("Google OAuth credentials not configured")
            return
        self._google = self._oauth.register(
            name="google",
            client_id=config.GOOGLE_CLIENT_ID,
            client_secret=config.GOOGLE_CLIENT_SECRET,
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile", "prompt": "select_account"},
        )

    def google_redirect(self):
        if not self._google:
            raise RuntimeError("Google OAuth not configured")
        return self._google.authorize_redirect(url_for("auth.google_callback", _external=True))

    def google_callback(self) -> dict:
        if not self._google:
            raise RuntimeError("Google OAuth not configured")
        token = self._google.authorize_access_token()
        info = token.get("userinfo") or self._google.get("https://www.googleapis.com/oauth2/v3/userinfo").json()
        if not info:
            raise RuntimeError("Failed to retrieve user info from Google")

        provider_uid = info["sub"]
        email = info["email"]
        username = info.get("name", email.split("@")[0])
        avatar = info.get("picture")

        user = self._user.by_oauth("google", provider_uid)
        if user:
            user_id = user["id"]
        else:
            existing = self._user.by_email(email)
            if existing:
                user_id = existing["id"]
                self._user.link_oauth(user_id, "google", provider_uid, avatar)
            else:
                user_id = self._user.create_oauth(username, email, "google", provider_uid, avatar)
            user = self._user.by_id(user_id)

        return {
            "access_token": self._auth.issue_access(user["id"], user["email"]),
            "refresh_token": self._auth.issue_refresh(user["id"]),
            "user": {"id": user["id"], "username": user["username"], "email": user["email"]},
        }
