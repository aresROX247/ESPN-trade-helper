<#
  One-step installer for Windows.

  Usage (from the project folder):
    powershell -ExecutionPolicy Bypass -File .\install.ps1

  It checks Node.js, installs dependencies, verifies a usable browser, and can
  launch the guided importer and the viewer for you. It always calls npm.cmd so a
  locked-down PowerShell execution policy cannot block the install.
#>

$ErrorActionPreference = 'Stop'
$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectPath

function Write-Step($message) {
  Write-Host ''
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Stop-WithHelp($message, $url) {
  Write-Host ''
  Write-Host $message -ForegroundColor Yellow
  if ($url) { Start-Process $url }
  Write-Host ''
}

Write-Host 'ESPN Fantasy League Viewer - installer' -ForegroundColor Green

Write-Step 'Checking Node.js'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Stop-WithHelp 'Node.js was not found. Install the LTS version from https://nodejs.org/en/download and run this installer again.' 'https://nodejs.org/en/download'
  exit 1
}

$nodeVersion = (& node --version).Trim().TrimStart('v')
$nodeMajor = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -lt 20) {
  Stop-WithHelp "Node.js $nodeVersion is too old. Version 20 or newer is required. Download the LTS release from https://nodejs.org/en/download." 'https://nodejs.org/en/download'
  exit 1
}
Write-Host "Found Node.js $nodeVersion."

Write-Step 'Locating npm'
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if ($npmCommand) {
  $npmPath = $npmCommand.Source
} else {
  $npmPath = Join-Path $env:ProgramFiles 'nodejs\npm.cmd'
  if (-not (Test-Path $npmPath)) {
    Stop-WithHelp 'npm.cmd was not found. Reinstall Node.js from https://nodejs.org/en/download, then run this installer again.' 'https://nodejs.org/en/download'
    exit 1
  }
}
Write-Host "Using $npmPath"

Write-Step 'Installing dependencies'
& $npmPath install --no-audit --no-fund --loglevel=error
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Dependency installation failed. Scroll up for the npm error, then run this installer again.' -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Step 'Verifying the environment'
& node scripts\setup.js --install
$setupExitCode = $LASTEXITCODE

Write-Host ''
if ($setupExitCode -ne 0) {
  Write-Host 'Setup finished with warnings. You can still try importing a league.' -ForegroundColor Yellow
} else {
  Write-Host 'Setup complete.' -ForegroundColor Green
}

$importAnswer = Read-Host 'Import a league now? It opens a browser for ESPN sign-in (Y/n)'
if ($importAnswer -notmatch '^[Nn]') {
  & node browser-import.js
}

Write-Host ''
$viewAnswer = Read-Host 'Start the viewer now? (Y/n)'
if ($viewAnswer -notmatch '^[Nn]') {
  Write-Host 'Starting the viewer. Press Ctrl+C in this window to stop it.' -ForegroundColor Cyan
  & node bin\espn-fantasy.js app
} else {
  Write-Host 'Run "npm start" any time to open the viewer.' -ForegroundColor Cyan
}
