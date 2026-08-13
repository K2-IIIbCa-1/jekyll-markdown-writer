@echo off
setlocal
cd /d "%~dp0"

echo Starting Jekyll Writer at http://127.0.0.1:4170
call npm.cmd run build:editor
if errorlevel 1 (
  echo Failed to build the editor bundle.
  pause
  exit /b 1
)
node src\server.js
set "exitCode=%ERRORLEVEL%"

echo.
if "%exitCode%"=="0" (
  echo Jekyll Writer stopped.
) else (
  echo Jekyll Writer stopped with exit code %exitCode%.
)
pause
exit /b %exitCode%
