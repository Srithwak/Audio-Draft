@echo off
echo ============================================
echo   Audio-Draft Setup
echo ============================================
echo.

:: Step 1: Prompt for PostgreSQL password and create .env
echo [1/4] Configuring database credentials...
set /p DB_PASS="Enter your PostgreSQL password: "

(
echo DB_NAME=audiodraft
echo DB_USER=postgres
echo DB_PASSWORD=%DB_PASS%
echo DB_HOST=localhost
echo DB_PORT=5432
) > .env

echo       .env file created.
echo.

:: Step 2: Install Python dependencies
echo [2/4] Installing Python dependencies...
pip install -r requirements.txt
echo.

:: Step 3: Initialize database and run schema
echo [3/4] Setting up database...
python init_db.py
echo.

:: Step 4: Start the application
echo [4/4] Starting Audio-Draft...
echo       Opening http://localhost:5000 in your browser...
start http://localhost:5000
python backend/app.py

pause
