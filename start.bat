@echo off
setlocal

echo ===========================================
echo    Starting Audio-Draft2 Setup ^& Launch
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
    if exist "database\.env.example" (
        echo WARNING: database\.env not found. Copying from .env.example...
        copy "database\.env.example" "database\.env" >nul
        echo Please edit database\.env with your credentials.
    ) else (
        echo WARNING: database\.env and database\.env.example not found.
    )
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
echo    Launching Audio-Draft2 Desktop App
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
