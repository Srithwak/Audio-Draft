@echo off
setlocal

echo ===========================================
echo    Starting Audio-Draft Setup ^& Launch
echo ===========================================

REM Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check for .env file in database folder
if not exist "database\.env" (
    echo ===========================================
    echo   INITIAL SETUP REQUIRED
    echo ===========================================
    echo Audio-Draft requires Supabase and Spotify to function.
    echo Please follow the README instructions to create these accounts.
    echo.
    set /p SUPA_URL="Enter Supabase Project URL: "
    set /p SUPA_ANON="Enter Supabase Anon Key: "
    set /p SUPA_DB="Enter Supabase Direct Connection String: "
    echo.
    set /p SPOT_ID="Enter Spotify Client ID: "
    set /p SPOT_SEC="Enter Spotify Client Secret: "
    
    (
    echo API_URL="%SUPA_URL%"
    echo ANON_PUBLIC_KEY="%SUPA_ANON%"
    echo SUPABASE_DIRECT_CONNECT="%SUPA_DB%"
    echo SPOTIFY_CLIENT_ID="%SPOT_ID%"
    echo SPOTIFY_CLIENT_SECRET="%SPOT_SEC%"
    ) > "database\.env"
    
    echo.
    echo Credentials saved to database\.env!
    echo Reminder: Make sure you run database\initialize_db.sql in your Supabase SQL Editor!
) else (
    echo database\.env found. Skipping initial setup.
)

REM Install dependencies
echo.
echo Installing dependencies...
call npm install

REM Kill any existing node instances that might occupy port 3000
echo Stopping background node processes...
taskkill /IM node.exe /F 2>nul 1>nul

REM Start the server in the background using start /B
echo Starting server...
start /B node server.js

REM Wait a moment for the server to spin up
timeout /t 3 /nobreak >nul

echo =========================================
echo    Launching Audio-Draft Desktop App
echo =========================================
echo Launching...

REM Launch the Electron Desktop app window
set ELECTRON_RUN_AS_NODE=
call npm run start:desktop

echo.
echo App closed. Press any key to safely shut down the background server.
pause >nul

REM Cleanup the backend process after app closes
taskkill /IM node.exe /F 2>nul 1>nul
echo Environment cleaned up.
exit
