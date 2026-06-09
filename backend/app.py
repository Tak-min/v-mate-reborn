"""Flask application factory — entry point only."""
from gevent import monkey
monkey.patch_all()

import logging

from flask import send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO
from werkzeug.middleware.proxy_fix import ProxyFix

from backend import config

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def create_app():
    from flask import Flask
    app = Flask(
        __name__,
        static_folder=str(config.FRONTEND_DIR),
        template_folder=str(config.FRONTEND_DIR),
        static_url_path="",
    )
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
    app.config["SECRET_KEY"] = config.SECRET_KEY

    CORS(app)

    # ── Singletons ─────────────────────────────────────────────────────────
    from backend.models.user import UserModel
    from backend.auth.manager import AuthManager
    from backend.auth.oauth import OAuthManager
    from backend.core.memory import MemoryManager
    from backend.core.ai import AIConversationManager

    user_model = UserModel(config.DATABASE_PATH)
    auth_manager = AuthManager(user_model)
    oauth_manager = OAuthManager(app, user_model, auth_manager)
    memory_manager = MemoryManager(config.DATABASE_PATH)
    ai_manager = AIConversationManager(memory_manager)

    tts_service = None
    if config.ELEVENLABS_API_KEY:
        try:
            from backend.services.tts import TTSService
            tts_service = TTSService()
        except Exception as exc:
            logger.warning("TTS unavailable: %s", exc)

    app.config.update(
        USER_MODEL=user_model,
        AUTH_MANAGER=auth_manager,
        OAUTH_MANAGER=oauth_manager,
        MEMORY_MANAGER=memory_manager,
        AI_MANAGER=ai_manager,
        TTS_SERVICE=tts_service,
    )

    # ── Blueprints ─────────────────────────────────────────────────────────
    from backend.api.auth import bp as auth_bp
    from backend.api.characters import bp as chars_bp
    from backend.api.misc import bp as misc_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(chars_bp)
    app.register_blueprint(misc_bp)

    # ── Static file routes ─────────────────────────────────────────────────
    @app.route("/")
    def index():
        return send_from_directory(str(config.FRONTEND_DIR), "index.html")

    @app.route("/models/<path:filename>")
    def serve_models(filename):
        return send_from_directory(str(config.MODELS_DIR), filename)

    @app.route("/audio/<path:filename>")
    def serve_audio(filename):
        return send_from_directory(str(config.AUDIO_DIR), filename)

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        return response

    # ── Socket.IO ─────────────────────────────────────────────────────────
    socketio = SocketIO(app, cors_allowed_origins="*", async_mode="gevent")
    from backend import sockets
    sockets.register(socketio, ai_manager, tts_service, memory_manager, auth_manager)

    return app, socketio


app, socketio = create_app()

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=config.PORT, debug=config.DEBUG, use_reloader=False, allow_unsafe_werkzeug=True)
