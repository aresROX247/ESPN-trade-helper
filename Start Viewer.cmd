@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Opening the download page...
  start "" "https://nodejs.org/en/download"
  echo Install the LTS version, then double-click this file again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing dependencies for the first run...
  call npm.cmd install --no-audit --no-fund --loglevel=error
  if errorlevel 1 (
    echo Dependency installation failed. Scroll up for details.
    pause
    exit /b 1
  )
)

echo Starting the ESPN Fantasy League Viewer...
call node bin\espn-fantasy.js app
if errorlevel 1 pause
