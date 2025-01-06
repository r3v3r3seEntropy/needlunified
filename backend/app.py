# app.py

from flask import Flask
from flask_session import Session
from flask_cors import CORS
from config import Config

# Import blueprint + DB init + data references
from text_routes import (
    text_bp,
    create_tables,
    load_questions,
    load_part2_questions,
    data,
    part2_questions
)

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    Session(app)
    CORS(app, supports_credentials=True)

    # Register the blueprint
    app.register_blueprint(text_bp)

    # Initialize DB + load data
    print("Initializing database and loading NeedlText data...")
    create_tables()
    data.clear()
    data.update(load_questions())
    part2_questions.clear()
    part2_questions.extend(load_part2_questions())
    print("Initialization complete.")

    return app

if __name__ == "__main__":
    application = create_app()
    application.run(host="0.0.0.0", port=5000, debug=True)
