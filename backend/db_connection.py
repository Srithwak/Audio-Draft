"""
db_connection.py — Database Connection Module
----------------------------------------------
How:  Uses python-dotenv to load credentials from .env,
      then psycopg2 to connect to local PostgreSQL.
Why:  Keeps DB logic in one reusable place.
"""

import os
import psycopg2
from dotenv import load_dotenv

# Load .env so credentials stay out of source code.
load_dotenv()


def get_connection():
    """Return a new psycopg2 connection to PostgreSQL."""
    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
    )
    return conn


def close_connection(conn):
    """Safely close a connection if it exists."""
    if conn is not None:
        conn.close()
