# Changelog

## 1.4.0 - 2026-09-18

Local AI and trade-insight release.

- Added support for **local OpenAI-compatible models** (Ollama, LM Studio, and similar). Check **Use a local OpenAI-compatible model** in the AI panel, enter the base URL (for example `http://localhost:11434/v1`) and the model name, and the analysis runs on your own machine instead of the OpenAI API. The settings are remembered in the browser.
- Added a **Test connection** button that verifies OpenAI or the local model server before an analysis, so a wrong base URL or model name fails fast with a clear message instead of a silent failure.
- Added **fit breakdown bars** in Trade Lab results and the live trade review. Each bar shows how lineup gain, player value, roster need, schedule, health, and partner benefit contribute to the fit score.
- Added a **Copy offer** button to trade reviews and Trade Lab cards. It puts a ready-to-paste offer summary on the clipboard, with a fallback for browsers without the async clipboard API.
- Fixed the local file server's path check: a crafted URL could read files from folders that sit next to `public/` (for example a backup copy of the viewer) because a plain prefix check accepted sibling folders. The check now requires the path to stay inside `public/`, and a regression test covers it.
- Hardened the server: it now binds to `127.0.0.1` only, static responses send `Cache-Control: no-store`, and more file types get the correct `Content-Type`.
- The AI endpoints now answer invalid request bodies with HTTP 400 instead of 502.
- Added unit tests for the local-model endpoint resolver, the timeout helper, and static file safety.

## 1.3.0 - 2026-09-18

Trade review release.

- Added a **Live trades** panel to the Trade Lab tab with a dropdown of the pending trade offers waiting on your answer.
- Each incoming offer gets a recommended action (**Accept**, **Lean accept**, **Consider a counter**, **Lean decline**, **Decline**) and a **Why** list explaining the lineup change, player value, roster need, schedule context, injury risk, and whether the offer is one-sided.
- Offers you sent are listed separately under **Sent by you (not scored)** and are never scored, so the advice only covers decisions that are still yours to make.
- The review shows both sides of the trade with projected points, draft rank, and injury status, plus a before/after comparison of your lineup and theirs.
- Added `public/trade-review.js`, a DOM-free module so the trade logic is covered by real unit tests instead of string checks.
- The importer now requests `view=mPendingTransactions` alongside the existing league views.
- Changing **Your team** now refreshes both the waiver sidebar and the live trades list instead of leaving stale data on screen.

## 1.2.0 - 2026-09-18

Installability and onboarding release.

- Added `install.ps1` and `install.sh` one-step installers that check Node.js, install dependencies, verify a browser, and offer to launch the importer and viewer.
- Added `Start Viewer.cmd` and `Import League.cmd` so Windows users can run the tool without a terminal.
- Added a single CLI entry point (`bin/espn-fantasy.js`) with `app`, `start`, `import`, `refresh`, `setup`, `doctor`, `open`, and `help`.
- Added `scripts/setup.js` plus an automatic `postinstall` check that reports Node.js, Playwright, and browser readiness without ever failing an install.
- Added `scripts/environment.js` with shared, cross-platform browser detection for Windows, macOS, and Linux. The importer now uses `executablePath` correctly and can fall back to Playwright's own Chromium.
- The viewer now opens `http://localhost:3000` automatically, unless `NO_OPEN=1` or `CI` is set.
- Added a `/api/version` endpoint and `npm run doctor` for faster bug reports.
- The Windows launcher now detects Node.js, opens the download page when it is missing, installs dependencies on first run, and supports `serve` and `setup` arguments.
- Added `engines`, `bin`, `files`, and `os` metadata to `package.json`, plus a pinned `.nvmrc`.
- Added `CONTRIBUTING.md`, `SECURITY.md`, issue templates, a pull request template, and `.editorconfig`.
- Added a release workflow that builds `ESPN Fantasy Importer.exe` on tag pushes and attaches it to the GitHub Release.
- Continuous integration now tests Node.js 20, 22, and 24 and syntax-checks every entry point.
- Expanded the README with install options, everyday commands, a troubleshooting table, and privacy details.

## 1.1.0 - 2026-09-07

- Added direct league URL importing without manual cookie fields.
- Saved exact league URLs for automatic refresh.
- Added named past-league sections with season labels.
- Added minimized browser importing and refresh.
- Added standings, team filters, roster filters, logos, and Trade Lab improvements.
- Added privacy safeguards, clear-data controls, tests, and GitHub Actions validation.
- Added importer progress and failure states.
- Saved the exact league URL during first import for automatic refreshes.
- Added refresh and clear imported data controls.
- Added standings with owner names and points-for sorting.
- Added team and position filters, logos, and owner display.
- Added an injury-avoidance option to Trade Lab.
- Added 1-for-1 and 2-for-1 trade offer modes.
- Removed ESPN cookies from saved browser profiles and migrated older saved entries.
- Added Node smoke tests and GitHub Actions validation.

## 1.0.0

- Added guided browser importing for private ESPN Fantasy leagues.
- Added local league, roster, and Trade Lab views.
