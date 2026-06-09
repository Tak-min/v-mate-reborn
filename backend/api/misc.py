"""Misc API endpoints: health, voices, user settings."""
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request

from backend.auth.manager import token_required
from backend import config

bp = Blueprint("misc", __name__)


@bp.get("/api/health")
def health():
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat()}), 200


@bp.get("/api/voices")
def voices():
    tts = current_app.config.get("TTS_SERVICE")
    available = []
    if tts:
        available = [
            {"id": cid, "name": name, "category": "anime"}
            for cid, name in tts.available_voices().items()
        ]
    return jsonify({
        "voices": available,
        "default_voice_id": config.VOICE_IDS.get("default"),
        "character_voices": {k: v for k, v in config.VOICE_IDS.items() if v},
    }), 200


@bp.get("/api/user/settings")
@token_required
def get_settings(current_user):
    um = current_app.config["USER_MODEL"]
    return jsonify({"settings": um.settings(current_user["user_id"])}), 200


@bp.put("/api/user/settings")
@token_required
def update_settings(current_user):
    um = current_app.config["USER_MODEL"]
    data = request.get_json(silent=True) or {}
    um.update_settings(current_user["user_id"], data.get("settings", {}))
    return jsonify({"message": "設定を更新しました"}), 200
