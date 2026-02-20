"""
auth.py — Authentication Module
---------------------------------
How:  bcrypt for hashing, psycopg2 for DB queries.
Why:  Separates auth logic from the rest of the app.
"""

import bcrypt
from db_connection import get_connection, close_connection

# Simple session dict — tracks who is logged in.
session = {
    "user_id": None,
    "username": None,
    "logged_in": False,
}


def register_user(username, email, password):
    """Hash password with bcrypt, insert new user, return user dict or None."""
    conn = None
    try:
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO Users (username, email, password_hash)
               VALUES (%s, %s, %s)
               RETURNING user_id, username, email, created_at;""",
            (username, email, hashed.decode("utf-8")),
        )
        user = cur.fetchone()
        conn.commit()
        return {"user_id": user[0], "username": user[1], "email": user[2], "created_at": user[3]}
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        close_connection(conn)


def login_user(email, password):
    """Verify email + password against DB. Returns username on success, None on failure."""
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT user_id, username, password_hash FROM Users WHERE email = %s;", (email,))
        row = cur.fetchone()
        if row is None:
            return None
        user_id, username, stored_hash = row
        if bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8")):
            session["user_id"] = user_id
            session["username"] = username
            session["logged_in"] = True
            return username
        return None
    except Exception as e:
        raise e
    finally:
        close_connection(conn)


def logout_user():
    """Clear session state."""
    session["user_id"] = None
    session["username"] = None
    session["logged_in"] = False
