import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from config import Config
import database
from services.scheduler_service import start_scheduler

# Import Blueprints
from routes.auth_routes import auth_bp
from routes.profile_routes import profile_bp
from routes.document_routes import document_bp
from routes.assistant_routes import assistant_bp
from routes.bill_routes import bill_bp
from routes.application_routes import app_bp
from routes.calendar_routes import calendar_bp
from routes.briefing_routes import briefing_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Configure CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # Initialize Database
    database.init_db()

    # Register Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(document_bp)
    app.register_blueprint(assistant_bp)
    app.register_blueprint(bill_bp)
    app.register_blueprint(app_bp)
    app.register_blueprint(calendar_bp)
    app.register_blueprint(briefing_bp)

    # Start persistent background scheduler for reminders
    start_scheduler()

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            "status": "healthy",
            "service": "Orbi Backend API",
            "version": "1.0.0",
            "environment": os.getenv("FLASK_ENV", "production")
        })

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Resource not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error occurred", "details": str(e)}), 500

    return app

app = create_app()

if __name__ == '__main__':
    print("Orbi Backend API running on http://127.0.0.1:5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
