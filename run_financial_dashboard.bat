@echo off
setlocal

REM === Set the file you want to open ===
set "HTML_FILE=financial_dashboard.html"

REM === Start the server in a new Command Prompt window ===
start "HTTP Server" cmd /k "python -m http.server 8000"

REM === Wait a moment to let the server start ===
timeout /t 2 >nul

REM === Open the file in the default browser ===
start "" "http://localhost:8000/%HTML_FILE%"

endlocal
