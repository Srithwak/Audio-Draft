# Audio-Draft — Documentation

## Overview

Audio-Draft is a Music Intelligence Platform built with Python, Flask, and PostgreSQL. It runs as a **native desktop application** using flaskwebgui (opens in Edge/Chrome app mode). It provides user authentication (registration, login, logout) and a song library browser, demonstrating a full vertical slice from database to frontend.

---

## Prerequisites

- **Python 3.10+** — [python.org/downloads](https://www.python.org/downloads/)
- **PostgreSQL 15+** — [postgresql.org/download](https://www.postgresql.org/download/)

---

## Quick Start

Clone the repo and run:

```
./build.bat
```

The script will:
1. Prompt you for your PostgreSQL password.
2. Create a `.env` file with your credentials.
3. Install all Python dependencies.
4. Launch the desktop application (which automatically creates the database and runs the schema).

---

## Project Structure

```
Audio-Draft/
├── backend/
│   ├── app.py              # Flask API server
│   ├── auth.py             # Authentication logic (bcrypt)
│   ├── db_connection.py    # PostgreSQL connection helper
│   └── main.py             # CLI entry point (alternative to desktop app)
├── database/
│   ├── relationalDatabase.txt   # Table definitions (reference)
│   └── schema.sql               # PostgreSQL schema (13 tables)
├── frontend/
│   ├── index.html          # Single-page HTML interface
│   ├── style.css           # Minimal CSS
│   └── app.js              # Frontend logic (Fetch API)
├── .gitignore              # Excludes .env, __pycache__, dist/, build/, and other files
├── build.bat               # One-click setup and launch script
├── desktop_app.py          # Desktop application entry point (pywebview)
├── init_db.py              # Database creation and schema runner
├── requirements.txt        # Python dependencies
├── README.md               # Quick start
└── documentation.md        # This file
```

---

## How It Works

### Application Entry Point

**`desktop_app.py`** is the main entry point. It:
1. Imports `init_db.py` and runs database setup (creates DB + tables if needed).
2. Opens a native desktop window using `flaskwebgui`, which launches the Flask server and displays it in Edge/Chrome app mode (no browser toolbar, looks like a native app).

When the desktop window is closed, the application exits cleanly.

---

### Database Layer

**`database/schema.sql`** defines 13 tables using PostgreSQL with UUID primary keys (via the `uuid-ossp` extension):

| Table | Purpose |
|-------|---------|
| Users | User accounts with hashed passwords |
| Songs | Song metadata (title, artist, album, genre) |
| Audio_Features | Spotify audio features per song |
| Mood_Tags | User-assigned mood labels for songs |
| Playlists | User-created playlists |
| Playlist_Versions | Versioned snapshots of playlists |
| Playlist_Songs | Song-to-version mappings with position |
| Collaborators | Shared playlist access with permission levels |
| Listening_History | Play history with skip/completion tracking |
| User_Analytics | Aggregated listening stats per timeframe |
| Notifications | In-app notification messages |
| Song_Popularity | Play counts and trending scores |
| Playlist_Exports | Records of playlists exported to Spotify |

All foreign keys use `ON DELETE CASCADE` (or `ON DELETE SET NULL` where appropriate).

**`init_db.py`** automates database setup:
1. Connects to the default `postgres` database.
2. Checks if `audiodraft` exists; creates it if not.
3. Connects to `audiodraft` and executes `schema.sql`.

---

### Backend Layer

**`backend/db_connection.py`** — Database connection module.
- Loads credentials from `.env` using `python-dotenv`.
- `get_connection()` returns a fresh `psycopg2` connection.
- `close_connection(conn)` safely closes a connection.

**`backend/auth.py`** — Authentication module.
- `register_user(username, email, password)` — Hashes password with `bcrypt`, inserts into Users table, returns user dict.
- `login_user(email, password)` — Fetches user by email, verifies hash with `bcrypt.checkpw`, returns username on success.
- `logout_user()` — Clears session state.
- Session is an in-memory dict: `{"user_id", "username", "logged_in"}`.

**`backend/app.py`** — Flask REST API.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves `frontend/index.html` |
| `/api/register` | POST | Creates a new user account |
| `/api/login` | POST | Authenticates and sets session cookie |
| `/api/logout` | POST | Clears session cookie |
| `/api/me` | GET | Returns current logged-in user |
| `/api/songs` | GET | Returns all songs (requires login) |

**`backend/main.py`** — CLI alternative. A text menu with the same Register/Login/Fetch Songs/Logout/Exit flow, useful for demos without the desktop window.

---

### Frontend Layer

**`frontend/index.html`** — Single-page layout with:
- Register form (username, email, password)
- Login form (email, password)
- Dashboard with song table (shown after login)

**`frontend/style.css`** — Minimal CSS for spacing and readability. No colors or custom fonts.

**`frontend/app.js`** — JavaScript logic:
- Sends fetch requests to the Flask API.
- Toggles between auth forms and dashboard based on login state.
- Renders song data into the HTML table.
- Escapes user input to prevent XSS.

---

### Build and Setup

**`build.bat`** — One-click setup script:
1. Prompts for PostgreSQL password.
2. Generates `.env` with the entered credentials.
3. Runs `pip install -r requirements.txt`.
4. Launches `desktop_app.py` (which handles DB init and opens the desktop window).

**`.env`** (generated by build.bat, not committed) — Contains:
```
DB_NAME=audiodraft
DB_USER=postgres
DB_PASSWORD=<user-provided>
DB_HOST=localhost
DB_PORT=5432
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | Python 3 |
| Desktop GUI | flaskwebgui |
| Web Framework | Flask |
| Database | PostgreSQL |
| DB Driver | psycopg2-binary |
| Password Hashing | bcrypt |
| Config Management | python-dotenv |
| Frontend | HTML, CSS, JavaScript |
| CORS | flask-cors |

---

## Running Without the Build Script

If you prefer manual setup:

```bash
# 1. Create .env file with your credentials
# 2. Install dependencies
pip install -r requirements.txt

# 3. Launch desktop application (handles DB init automatically)
python desktop_app.py
```

For the CLI version instead:
```bash
python init_db.py
python backend/main.py
```

---

## Inserting Test Data

To populate the Songs table, run this SQL in pgAdmin or psql:

```sql
INSERT INTO Songs (title, artist, album, genre, duration_ms) VALUES
    ('Blinding Lights', 'The Weeknd', 'After Hours', 'Synth-pop', 200040),
    ('Bohemian Rhapsody', 'Queen', 'A Night at the Opera', 'Rock', 354000),
    ('Espresso', 'Sabrina Carpenter', 'Short n Sweet', 'Pop', 175000);
```
