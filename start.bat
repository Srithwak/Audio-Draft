@echo off
echo =========================================
echo    Starting Audio-Draft2 Local Server
echo =========================================

REM Kill any existing node instances that might occupy port 3000
echo Stopping background node processes...
taskkill /IM node.exe /F 2>nul

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
taskkill /IM node.exe /F 2>nul
echo Environment cleaned up.
exit
