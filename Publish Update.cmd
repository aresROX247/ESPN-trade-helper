@echo off
setlocal
cd /d "%~dp0"

rem Double-click helper for publishing an update to GitHub.
rem It stages your changes, commits them with a message you type, and pushes.

where git >nul 2>nul
if errorlevel 1 (
  echo Git is required. Opening the download page...
  start "" "https://git-scm.com/downloads"
  echo Install Git, then double-click this file again.
  pause
  exit /b 1
)

echo Checking for changes...
set CHANGES=
for /f "delims=" %%i in ('git status --porcelain') do set CHANGES=1
if not defined CHANGES (
  echo.
  echo Nothing to publish. Your project already matches GitHub.
  pause
  exit /b 0
)

echo.
echo These files will be published:
git status --short
echo.

set /p MESSAGE=Describe this update: 
if "%MESSAGE%"=="" set MESSAGE=Update the project

git add -A

rem Safety net: never publish private league data or a live ESPN session.
set PRIVATE=
for /f "delims=" %%i in ('git diff --cached --name-only') do (
  echo %%i | findstr /i /c:"league-data.json" /c:"espn-browser-profile" >nul && set PRIVATE=%%i
)
if defined PRIVATE (
  echo.
  echo STOPPED: %PRIVATE% contains private data and should never be published.
  echo Remove it from the staged changes, then try again.
  git reset >nul
  pause
  exit /b 1
)

git commit -m "%MESSAGE%"
if errorlevel 1 (
  echo.
  echo The commit failed. Read the message above, then try again.
  pause
  exit /b 1
)

echo.
echo Pushing to GitHub...
git push
if errorlevel 1 (
  echo.
  echo The push failed. If the message mentions "non-fast-forward", someone
  echo changed the repository on GitHub. Run this first, then try again:
  echo     git pull --no-rebase
  pause
  exit /b 1
)

echo.
echo Published successfully.
echo https://github.com/aresROX247/ESPN-trade-helper
pause