@echo off
echo ========================================
echo WebRTC Healthcare Signaling Server
echo ========================================
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
    echo.
)

echo Starting server...
echo.
echo Server will be available at:
echo   - Local: http://localhost:3000
echo   - Network: http://YOUR_IP:3000
echo.
echo Press Ctrl+C to stop the server
echo.

npm start
