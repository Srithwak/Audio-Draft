"""
init_db.py — Database Initialization Script
-------------------------------------------
How:  Connects to the default 'postgres' database to create the
      'audiodraft' database, then switches to it to run schema.sql.
Why:  Automates the manual setup steps in pgAdmin.
"""

import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from dotenv import load_dotenv

# Load .env for credentials (DB_USER, DB_PASSWORD, etc.)
load_dotenv()

DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
TARGET_DB = os.getenv("DB_NAME", "audiodraft")


def create_database():
    """Create the database if it doesn't exist."""
    print(f"[*] Connecting to default 'postgres' database...")
    
    # Connect to default 'postgres' db to create the new one
    conn = psycopg2.connect(
        dbname="postgres",
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    # Check if database exists
    cur.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = %s", (TARGET_DB,))
    exists = cur.fetchone()

    if not exists:
        print(f"[*] Creating database '{TARGET_DB}'...")
        cur.execute(f"CREATE DATABASE {TARGET_DB}")
        print(f"[+] Database '{TARGET_DB}' created successfully.")
    else:
        print(f"[!] Database '{TARGET_DB}' already exists. Skipping creation.")

    cur.close()
    conn.close()


def run_schema():
    """Run the schema.sql file on the target database."""
    print(f"[*] Connecting to '{TARGET_DB}' to run schema...")
    
    conn = psycopg2.connect(
        dbname=TARGET_DB,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    
    schema_path = os.path.join("database", "schema.sql")
    with open(schema_path, "r") as f:
        schema_sql = f.read()

    cur = conn.cursor()
    cur.execute(schema_sql)
    conn.commit()
    
    print("[+] Schema executed successfully. Tables created.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    try:
        create_database()
        run_schema()
        print("\n[✓] Setup complete! You can now run the app.")
    except Exception as e:
        print(f"\n[✗] Error: {e}")
        print("    Check your .env file to make sure DB_PASSWORD is correct.")
