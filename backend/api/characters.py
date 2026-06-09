"""Character CRUD blueprint."""
import logging

from flask import Blueprint, current_app, jsonify, request

from backend.auth.manager import token_required
from backend import config

logger = logging.getLogger(__name__)
bp = Blueprint("characters", __name__, url_prefix="/api/characters")


def _um():
    return current_app.config["USER_MODEL"]


@bp.get("")
@token_required
def list_characters(current_user):
    chars = _um().characters(current_user["user_id"])
    if not chars:
        cid = _um().create_character(
            user_id=current_user["user_id"],
            name="シロ",
            vrm_file="Shiro.vrm",
            prompt=config.SHIRO_PROMPT,
            voice_id=config.VOICE_IDS.get("shiro", ""),
            is_default=True,
        )
        chars = _um().characters(current_user["user_id"])
    return jsonify({"characters": chars}), 200


@bp.post("")
@token_required
def create(current_user):
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    vrm_file = data.get("vrm_file", "").strip()
    prompt = data.get("prompt", "").strip()
    voice_id = data.get("voice_id", "").strip()
    is_default = bool(data.get("is_default", False))

    if not all([name, vrm_file, prompt]):
        return jsonify({"error": "name, vrm_file, prompt は必須です"}), 400

    cid = _um().create_character(current_user["user_id"], name, vrm_file, prompt, voice_id, is_default)
    if not cid:
        return jsonify({"error": "キャラクターの作成に失敗しました"}), 500

    return jsonify({"message": "キャラクターを作成しました", "character": _um().character_by_id(cid)}), 201


@bp.get("/<int:character_id>")
@token_required
def get(current_user, character_id):
    char = _um().character_by_id(character_id)
    if not char:
        return jsonify({"error": "キャラクターが見つかりません"}), 404
    if char["user_id"] != current_user["user_id"]:
        return jsonify({"error": "アクセス権限がありません"}), 403
    return jsonify({"character": char}), 200


@bp.put("/<int:character_id>")
@token_required
def update(current_user, character_id):
    char = _um().character_by_id(character_id)
    if not char:
        return jsonify({"error": "キャラクターが見つかりません"}), 404
    if char["user_id"] != current_user["user_id"]:
        return jsonify({"error": "アクセス権限がありません"}), 403

    data = request.get_json(silent=True) or {}
    _um().update_character(
        character_id,
        name=data.get("name"),
        prompt=data.get("prompt"),
        voice_id=data.get("voice_id"),
        is_default=data.get("is_default"),
    )
    return jsonify({"message": "更新しました", "character": _um().character_by_id(character_id)}), 200


@bp.delete("/<int:character_id>")
@token_required
def delete(current_user, character_id):
    char = _um().character_by_id(character_id)
    if not char:
        return jsonify({"error": "キャラクターが見つかりません"}), 404
    if char["user_id"] != current_user["user_id"]:
        return jsonify({"error": "アクセス権限がありません"}), 403
    _um().delete_character(character_id)
    return jsonify({"message": "削除しました"}), 200
