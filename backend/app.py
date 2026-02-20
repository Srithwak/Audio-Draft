"""
app.py — Flask API
--------------------
How:  Wraps auth.py into REST endpoints, serves frontend HTML.
Why:  Connects the browser UI to the PostgreSQL backend.
"""

import os
import sys
import bcrypt
from flask import Flask, request, jsonify, send_from_directory, session as flask_session
from flask_cors import CORS

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_connection import get_connection, close_connection

app = Flask(
    __name__,
    static_folder=os.path.join(os.path.dirname(__file__), "..", "frontend"),
    static_url_path="",
)
app.secret_key = os.urandom(24)
CORS(app)


# --- Serve frontend ---
@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


# --- Register ---
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()

    if not username or not email or not password:
        return jsonify({"error": "All fields required."}), 400

    conn = None
    try:
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO Users (username, email, password_hash) VALUES (%s, %s, %s) RETURNING user_id, username;",
            (username, email, hashed.decode("utf-8")),
        )
        user = cur.fetchone()
        conn.commit()
        return jsonify({"message": "Registered.", "username": user[1]}), 201
    except Exception as e:
        if conn:
            conn.rollback()
        return jsonify({"error": str(e)}), 400
    finally:
        close_connection(conn)


# --- Login ---
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email", "").strip()
    password = data.get("password", "").strip()

    if not email or not password:
        return jsonify({"error": "Email and password required."}), 400

    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT user_id, username, password_hash FROM Users WHERE email = %s;", (email,))
        row = cur.fetchone()
        if row is None:
            return jsonify({"error": "No account with that email."}), 401
        user_id, username, stored_hash = row
        if bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8")):
            flask_session["user_id"] = str(user_id)
            flask_session["username"] = username
            return jsonify({"message": "Logged in.", "username": username}), 200
        return jsonify({"error": "Wrong password."}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        close_connection(conn)


# --- Logout ---
@app.route("/api/logout", methods=["POST"])
def logout():
    flask_session.clear()
    return jsonify({"message": "Logged out."}), 200


# --- Current user ---
@app.route("/api/me", methods=["GET"])
def me():
    if "user_id" in flask_session:
        return jsonify({"username": flask_session["username"]}), 200
    return jsonify({"error": "Not logged in."}), 401


# --- Songs ---
@app.route("/api/songs", methods=["GET"])
def get_songs():
    if "user_id" not in flask_session:
        return jsonify({"error": "Login required."}), 401

    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT song_id, title, artist, album, genre, duration_ms FROM Songs;")
        rows = cur.fetchall()
        songs = [{"song_id": str(r[0]), "title": r[1], "artist": r[2],
                   "album": r[3], "genre": r[4], "duration_ms": r[5]} for r in rows]
        return jsonify({"songs": songs}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        close_connection(conn)


if __name__ == "__main__":
    print("\n  Running at http://localhost:5000\n")
    app.run(debug=True, port=5000)
