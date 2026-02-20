@echo off
echo ============================================
echo   Audio-Draft Setup
echo ============================================
echo.

:: Step 1: Prompt for PostgreSQL password and create .env
echo [1/3] Configuring database credentials...
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
echo [2/3] Installing Python dependencies...
pip install -r requirements.txt
echo.

:: Step 3: Launch the desktop application
echo [3/3] Launching Audio-Draft...
python desktop_app.py

pause
