"""Authentication blueprint: register, login, logout, refresh, OAuth."""
import json
import logging
import re

from flask import Blueprint, current_app, jsonify, request

from backend.auth.manager import token_required

logger = logging.getLogger(__name__)
bp = Blueprint("auth", __name__, url_prefix="/api/auth")

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")


def _user_model():
    return current_app.config["USER_MODEL"]

def _auth():
    return current_app.config["AUTH_MANAGER"]

def _oauth():
    return current_app.config["OAUTH_MANAGER"]


@bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if len(username) < 3:
        return jsonify({"error": "ユーザー名は3文字以上で入力してください"}), 400
    if not _EMAIL_RE.match(email):
        return jsonify({"error": "有効なメールアドレスを入力してください"}), 400
    if len(password) < 6:
        return jsonify({"error": "パスワードは6文字以上で入力してください"}), 400

    try:
        uid = _user_model().create(username, email, password)
    except Exception:
        logger.exception("register error")
        return jsonify({"error": "登録処理中にエラーが発生しました"}), 500

    if uid is None:
        return jsonify({"error": "このメールアドレスまたはユーザー名は既に使用されています"}), 409

    user = _user_model().by_id(uid)
    return jsonify({
        "message": "登録が完了しました",
        "access_token": _auth().issue_access(uid, email),
        "refresh_token": _auth().issue_refresh(uid),
        "user": {"id": uid, "username": user["username"], "email": email},
    }), 201


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "メールアドレスとパスワードを入力してください"}), 400

    user = _user_model().verify_password(email, password)
    if not user:
        return jsonify({"error": "メールアドレスまたはパスワードが正しくありません"}), 401

    _auth().revoke_all(user["id"])
    _user_model().touch_login(user["id"])

    return jsonify({
        "message": "ログインに成功しました",
        "access_token": _auth().issue_access(user["id"], user["email"]),
        "refresh_token": _auth().issue_refresh(user["id"]),
        "user": {"id": user["id"], "username": user["username"], "email": user["email"]},
    }), 200


@bp.post("/refresh")
def refresh():
    data = request.get_json(silent=True) or {}
    rt = data.get("refresh_token")
    if not rt:
        return jsonify({"error": "リフレッシュトークンが必要です"}), 400
    result = _auth().refresh(rt)
    if not result:
        return jsonify({"error": "無効または期限切れのリフレッシュトークンです"}), 401
    return jsonify(result), 200


@bp.post("/logout")
@token_required
def logout(current_user):
    _auth().revoke_all(current_user["user_id"])
    return jsonify({"message": "ログアウトしました"}), 200


@bp.get("/me")
@token_required
def me(current_user):
    user = _user_model().by_id(current_user["user_id"])
    if not user:
        return jsonify({"error": "ユーザーが見つかりません"}), 404
    settings = _user_model().settings(user["id"])
    return jsonify({"user": user, "settings": settings}), 200


@bp.get("/google")
def google_login():
    return _oauth().google_redirect()


@bp.get("/google/callback")
def google_callback():
    try:
        result = _oauth().google_callback()
        _user_model().touch_login(result["user"]["id"])
        user_json = json.dumps(result["user"])
        at = result["access_token"]
        rt = result["refresh_token"]
        return f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><title>認証成功</title></head>
        <body>
        <script>
        localStorage.setItem('access_token', '{at}');
        localStorage.setItem('refresh_token', '{rt}');
        localStorage.setItem('user', `{user_json}`);
        setTimeout(() => {{ window.location.href = '/'; }}, 300);
        </script>
        <p>認証成功 — リダイレクト中...</p>
        </body></html>"""
    except Exception as exc:
        logger.error("Google callback error: %s", exc)
        return f"<p>認証に失敗しました: {exc}</p><a href='/auth/login.html'>戻る</a>", 400
