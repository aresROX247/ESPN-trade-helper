# ESPN Fantasy League Viewer

![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Platforms](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![License](https://img.shields.io/badge/license-MIT-blue)
[![Validate](https://github.com/aresROX247/ESPN-trade-helper/actions/workflows/ci.yml/badge.svg)](https://github.com/aresROX247/ESPN-trade-helper/actions/workflows/ci.yml)

**Version 1.3.0**

Import a private ESPN Fantasy Football league and browse it in a local web dashboard: standings, owners, logos, rosters, points for, a Trade Lab, a live review of the trade offers other managers sent you, a waiver-wire sidebar, and an optional AI trade analyst.

It opens a real browser for ESPN sign-in, reuses that authenticated session to pull your league, and serves the result from `http://localhost:3000`. Your ESPN cookies stay inside a local browser profile and nothing is uploaded anywhere.

---

## Install

Pick whichever path fits you. Every path needs **Node.js 20 or newer** and **Microsoft Edge, Google Chrome, or Chromium**.

### Option 1 - One-click installers (recommended)

Download or clone the project, then run the installer for your system. It checks Node.js, installs dependencies, verifies your browser, and can launch the importer and the viewer for you.

**Windows** - double-click `install.ps1`, or from the project folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

**macOS and Linux** - from the project folder:

```bash
bash ./install.sh
```

### Option 2 - Double-click launchers (Windows)

If dependencies are already installed you never need a terminal again:

| File | What it does |
| --- | --- |
| `Start Viewer.cmd` | Starts the viewer and opens the dashboard |
| `Import League.cmd` | Opens a browser to import or re-import a league |

Both install dependencies automatically on first run.

### Option 3 - Manual setup

```bash
git clone https://github.com/aresROX247/ESPN-trade-helper.git
cd ESPN-trade-helper
npm install
npm run setup
```

`npm install` also runs the setup check automatically and never fails the install. `npm run setup` verifies Node.js, Playwright, and your browser, and tells you exactly what to fix if anything is missing.

> **Downloaded a ZIP instead of cloning?** Unzip it and run the commands from inside the folder that contains `package.json`. If your copy still lives in a subfolder such as `ESPN-trade-helper-1.2`, run everything from inside that subfolder.

---

## Quick start

```bash
npm install       # installs Playwright and runs the setup check
npm run browser   # opens a browser so you can import your league
npm run app       # starts the viewer and opens http://localhost:3000
```

---

## Requirements

| Requirement | Notes |
| --- | --- |
| Node.js 20+ | `npm run doctor` reports your version and links the matching download |
| Microsoft Edge, Google Chrome, or Chromium | Detected automatically on Windows, macOS, and Linux |
| Access to the ESPN league | Private leagues only require that you can sign in to ESPN |

Playwright is the only runtime dependency, and the project ships a locked `package-lock.json` so installs are reproducible.

---

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm start` | Starts the local viewer without opening a browser |
| `npm run app` | Starts the viewer and opens the dashboard for you |
| `npm run browser` | Guided importer: opens a browser for ESPN sign-in |
| `npm run import` | Same as `npm run browser`, through the CLI |
| `npm run refresh` | Re-imports the saved league URL |
| `npm run setup` | Checks Node.js, Playwright, and browser readiness |
| `npm run doctor` | Same as setup, with extra platform details for bug reports |
| `npm test` | Runs the release checks |
| `npm run build:exe` | Builds the optional Windows launcher (Windows only) |

Run `npm link` once to get a single global command instead:

```bash
espn-fantasy            # check the environment, start the viewer, open it
espn-fantasy import     # guided league import
espn-fantasy refresh    # re-import the saved league URL
espn-fantasy setup      # readiness report
espn-fantasy doctor     # troubleshooting report
espn-fantasy help       # list every command
```

### Environment variables

| Variable | Effect |
| --- | --- |
| `PORT` | Change the viewer port (default `3000`) |
| `NO_OPEN=1` | Never open the dashboard automatically |
| `CI=true` | Same as `NO_OPEN=1`, used by automated runs |

---

## Import a league

```bash
npm run browser
```

1. A browser window opens. Sign in to ESPN if you are not already signed in.
2. Open your league page, or paste the full league URL into the dashboard.
3. Watch the terminal for progress. The result is saved next to the project as `league-data.json`.

The importer launches the ESPN browser minimized. Restore it if ESPN asks you to sign in or verify the session.

The exact league URL is saved inside `league-data.json` on the first import. After that, **Refresh data** in the viewer (or `npm run refresh`) reopens that URL and pulls new data automatically. You only need to select the league again if your ESPN session expires or the league URL changes.

### Where your data lives

| Path | Contents | Safe to commit? |
| --- | --- | --- |
| `league-data.json` | Imported league, teams, owners, rosters, and players | **No** - private league data |
| `.espn-browser-profile/` | ESPN sign-in session for the importer browser | **No** - contains live cookies |

Both are already ignored by `.gitignore`.

---

## Run the viewer

```bash
npm start        # no browser is opened
npm run app      # opens http://localhost:3000 for you
```

Then use:

- **Import league URL** / **Refresh data** to pull fresh data without leaving the dashboard
- **Clear imported data** to delete `league-data.json` from this computer
- **Find a team** and **Position** to filter what you see
- **Trade lab** for 1-for-1 and 2-for-1 injury-aware trade ideas
- **Live trades** for a dropdown of the pending offers other managers sent you, each scored with a recommended action and the reasons behind it
- **Available players** on the waiver sidebar for rule-based `TARGET`, `WATCH`, and `PASS` guidance

---

## Reviewing trade offers

Open **Trade lab** and use the **Choose a trade** dropdown at the top. It lists two groups:

| Group | What you get |
| --- | --- |
| **Waiting on your answer** | Offers another manager sent you. Each one is scored and labelled **Accept**, **Lean accept**, **Consider a counter**, **Lean decline**, or **Decline**, followed by the specific reasons. |
| **Sent by you (not scored)** | Offers you sent. They are listed so you can still see them, but they are never scored, because there is no decision left for you to make. |

For an offer waiting on you, the review shows:

- the exact players you receive and give up, with projected points, draft rank, and injury status
- how your best starting lineup changes, and what the other manager gains
- a **Why** list with each reason tagged as a gain, a loss, or an alert (injured player, missing data, one-sided value)
- the same fit-point breakdown the Trade Lab generator uses

The score is decision support, not a guarantee. ESPN still processes a trade on its own schedule after both managers accept, so accept or decline it in ESPN as well.

Pending offers come from ESPN's `mPendingTransactions` view, which is imported with the rest of your league. If a trade was just sent, use **Refresh data** to pull it in.

---

## Troubleshooting

Run `npm run doctor` first. It reports your Node.js version, whether Playwright is installed, and which browser was detected.

| Message or symptom | Fix |
| --- | --- |
| `npm.ps1 cannot be loaded because running scripts is disabled` | PowerShell blocks the `npm` script. Use `npm.cmd install` and `npm.cmd start`, or run the installer: `powershell -ExecutionPolicy Bypass -File .\install.ps1` |
| `Node.js ... is too old` or a syntax error on start | Install Node.js 20+ from [nodejs.org](https://nodejs.org/en/download). `nvm` users can run `nvm use` to pick up the pinned version in `.nvmrc` |
| `No supported browser was found` | Install Microsoft Edge or Google Chrome, or run `node scripts/setup.js --install` to download Playwright's own Chromium |
| `Playwright dependency is missing` | Run `npm install` |
| `ESPN did not accept the current sign-in` | Sign in to ESPN in the importer browser window, then click **Use this league** again |
| `ESPN returned a web page instead of league data` | Let the league page finish loading, confirm you can view the league, then retry |
| The importer window is minimized and asking for sign-in | Restore the window from the taskbar |
| `Port 3000 is already in use` | Close the other viewer, or start on another port: `$env:PORT=3001; npm start` (Windows) or `PORT=3001 npm start` (macOS and Linux) |
| `Import a league URL once before using Refresh data` | Run the first import before refreshing |
| The AI panel says **Locked** | Add your own OpenAI API key inside the panel to enable it |
| **Live trades** says no trades are waiting | ESPN only returns pending offers, so refresh after the offer is sent. Confirm you picked the right team in **Your team** |
| The Windows launcher closes instantly | Run `Start Viewer.cmd` instead so errors stay on screen, or run `npm run doctor` |

If you are still stuck, open an issue using the bug report template and paste the `npm run doctor` output.

---

## Privacy and security

- The importer never asks you to paste ESPN cookies. The `espn_s2` and `SWID` cookies are read from the local browser session and used only for ESPN requests made on your machine.
- Saved league profiles contain only the league URL, league ID, season, and league name. Cookies are never written to them.
- `league-data.json` and `.espn-browser-profile/` are ignored by Git. Keep them out of commits, screenshots, and issues.
- The server binds to your local machine and serves only files from `public/`.
- The AI panel is opt-in and the only feature that sends anything to a third party. See below.

Found a security problem? Please report it privately using the process in [SECURITY.md](SECURITY.md) instead of opening a public issue.

---

## Optional AI trade analyst

The AI panel stays disabled until you add your own OpenAI API key. The key is stored only in your browser's local storage and sent to the local server when you choose **Analyze trades**. It is never written to `league-data.json` and never logged by the app.

When you use it, your roster context and the players involved are sent to OpenAI so it can respond. Leave the panel locked if you do not want that.

AI suggestions are decision support, not guarantees.

---

## Windows executable

The optional `ESPN Fantasy Importer.exe` launcher:

- checks that Node.js is installed and opens the download page if it is missing
- runs `npm install` automatically on first launch
- starts the guided importer, and keeps the window open when something fails

Build it yourself from the project folder:

```powershell
.\build-exe.ps1
```

Tagged releases build this launcher automatically and attach it to the GitHub Release, so you can also just download it from the Releases page.

---

## Tests

```bash
npm test
```

`test/smoke.test.js` guards the privacy guarantees (no ESPN cookies in saved profiles), the importer's URL saving and refresh behavior, the viewer's key controls, and the release metadata. GitHub Actions runs the same tests plus `node --check` syntax validation on Node.js 20, 22, and 24 for every push and pull request.

---

## Project files

| Path | Purpose |
| --- | --- |
| `browser-import.js` | Opens the authenticated browser and imports league data |
| `server.js` | Local API and static viewer hosting |
| `public/` | Viewer interface (`index.html`, `app.js`, `styles.css`) |
| `public/trade-review.js` | Trade review logic, kept free of DOM access so `node --test` can cover it |
| `bin/espn-fantasy.js` | Single CLI entry point |
| `scripts/environment.js` | Shared Node.js, Playwright, and browser detection |
| `scripts/setup.js` | Setup and troubleshooting report |
| `install.ps1`, `install.sh` | One-step installers |
| `Start Viewer.cmd`, `Import League.cmd` | Double-click launchers for Windows |
| `ESPNFantasyImporter.cs`, `build-exe.ps1` | Windows launcher source and build script |
| `espn-fantasy.js` | Legacy example that used manual cookie entry. Not used by the viewer; kept for reference |
| `league-data.json` | Imported league data, generated at runtime and ignored by Git |

---

## Repository setup (maintainers)

This repository is wired to `https://github.com/aresROX247/ESPN-trade-helper`.

1. **Keep the project at the repository root.** GitHub only reads `.github/workflows/`, `SECURITY.md`, and `.github/ISSUE_TEMPLATE/` from the repository root, and `npm install` must run in the same folder as `package.json`. If the files are still nested inside a folder such as `ESPN-trade-helper-1.2/`, move them up to the root. Until then the **Validate** badge stays grey, because Actions cannot find the workflow.
2. **Never commit private data.** `git status` must not list `league-data.json`, `.espn-browser-profile/`, or `ESPN Fantasy Importer.exe`. All three are already in `.gitignore`.
3. **Tag a release** so the Windows launcher is built automatically and attached to the Releases page:

   ```bash
   git tag v1.2.0
   git push --tags
   ```

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first, then run `npm test` before opening a pull request.

## Disclaimer

This is an unofficial community project. It is not affiliated with, endorsed by, or supported by ESPN, Disney, OpenAI, Microsoft, or Google. Use it for your own leagues and accounts, and respect ESPN's terms of service.
