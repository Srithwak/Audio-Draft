"""
desktop_app.py — Desktop Application Entry Point
--------------------------------------------------
How:  Uses flaskwebgui to open the Flask app in a native
      desktop window (via Edge/Chrome app mode).
Why:  Gives the app a native desktop feel instead of
      running in a browser tab.
"""

import os
import sys

# Ensure backend/ is importable
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.app import app
from init_db import create_database, run_schema
from flaskwebgui import FlaskUI


def main():
    print("=== Audio-Draft Desktop ===")

    # 1. Initialize Database
    try:
        print("[1/2] Setting up database...")
        create_database()
        run_schema()
        print("      Database ready.")
    except Exception as e:
        print(f"      Database error: {e}")
        print("      Check your .env file credentials.")

    # 2. Launch desktop window
    print("[2/2] Opening application window...")
    FlaskUI(
        app=app,
        server="flask",
        width=900,
        height=700,
    ).run()


if __name__ == "__main__":
    main()
