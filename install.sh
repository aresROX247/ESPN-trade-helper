#!/usr/bin/env bash
# One-step installer for macOS and Linux.
#
# Usage (from the project folder):
#   bash ./install.sh

set -euo pipefail

project_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_path"

step() {
  printf '\n==> %s\n' "$1"
}

banner() {
  printf '\nESPN Fantasy League Viewer - installer\n'
}

banner

step 'Checking Node.js'
if ! command -v node >/dev/null 2>&1; then
  printf 'Node.js was not found. Install the LTS version from https://nodejs.org/en/download then run this installer again.\n'
  exit 1
fi

node_version="$(node --version | sed 's/^v//')"
node_major="${node_version%%.*}"
if [ "$node_major" -lt 20 ]; then
  printf 'Node.js %s is too old. Version 20 or newer is required.\n' "$node_version"
  printf 'Download the LTS release from https://nodejs.org/en/download\n'
  exit 1
fi
printf 'Found Node.js %s.\n' "$node_version"

step 'Installing dependencies'
npm install --no-audit --no-fund --loglevel=error

step 'Verifying the environment'
setup_failed=0
node scripts/setup.js --install || setup_failed=1

if [ "$setup_failed" -ne 0 ]; then
  printf '\nSetup finished with warnings. You can still try importing a league.\n'
else
  printf '\nSetup complete.\n'
fi

printf '\n'
read -r -p 'Import a league now? It opens a browser for ESPN sign-in (Y/n) ' import_answer
if [[ ! "$import_answer" =~ ^[Nn] ]]; then
  node browser-import.js || true
fi

printf '\n'
read -r -p 'Start the viewer now? (Y/n) ' view_answer
if [[ ! "$view_answer" =~ ^[Nn] ]]; then
  printf 'Starting the viewer. Press Ctrl+C in this window to stop it.\n'
  node bin/espn-fantasy.js app
else
  printf 'Run "npm start" any time to open the viewer.\n'
fi
