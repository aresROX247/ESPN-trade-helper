# ESPN-trade-helper

A local ESPN Fantasy Football league importer and viewer. It opens a real browser for ESPN sign-in, imports private league data using your authenticated session, and serves it through a local web interface.

## Features

- Guided browser sign-in with Playwright
- Imports private ESPN Fantasy league data without hard-coding cookies
- Saves the imported response to `league-data.json`
- Provides a local web server and dashboard
- Shows standings, owners, logos, rosters, and points for
- Filters teams by name, owner, and roster position
- Includes 1-for-1 and 2-for-1 injury-aware Trade Lab ideas plus refresh/clear-data controls
- Includes an optional Windows `.exe` launcher

## Requirements

- Windows
- Node.js 20 or newer
- Microsoft Edge or Google Chrome
- Access to the ESPN Fantasy league you want to import

## Setup

Install the dependencies:

```powershell
npm install
```

If Playwright cannot find a supported browser, install its Chromium browser:

```powershell
npx playwright install chromium
```

## Import a League

Run the guided importer:

```powershell
npm run browser
```

Paste the full ESPN Fantasy league page URL into the URL field and click **Import league URL**. The importer opens the saved ESPN browser session, navigates directly to that page, and pulls the league automatically. If the session is not signed in, sign in once in the opened browser and retry.

The imported data will be saved to:

```text
league-data.json
```

The exact league URL is saved inside that local file during the first import. After that, use **Refresh data** in the viewer to reopen the saved league URL and pull new data automatically. You will only need to click **Use this league** again if your ESPN session expires or the league URL changes.

The importer launches the ESPN browser minimized. Restore it if ESPN asks you to sign in or verify the session.

## Run the Viewer

Start the local web server:

```powershell
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.


<img width="2391" height="1416" alt="image" src="https://github.com/user-attachments/assets/aaa2c2d0-5ec9-46c3-8a43-68efa5088235" />



The browser importer can also be started from the web interface when supported by the dashboard.

Use **Refresh data** after the league changes. Use **Clear imported data** to remove the local JSON export from this computer.

## Tests

Run the release checks locally:

```powershell
npm test
```

GitHub Actions runs the same tests and JavaScript syntax checks for pushes and pull requests.

## Windows Executable

To build the optional launcher executable, run PowerShell from the project folder:

```powershell
.\build-exe.ps1
```

This creates `ESPN Fantasy Importer.exe`, which starts the browser importer through npm.

## Important Security Notes

- Do not commit `.espn-browser-profile`, `league-data.json`, or any ESPN cookies to a public repository.
- The browser profile may contain an active ESPN session.
- Imported league data can contain private team, member, roster, and league information.
- Saved league profiles contain only the league ID and season; ESPN cookies are never saved by the viewer.
- Add sensitive files to `.gitignore` before publishing this project.

## Project Files

- `browser-import.js` - Opens the authenticated browser and imports league data
- `server.js` - Runs the local API and web server
- `public/` - Local viewer interface
- `ESPNFantasyImporter.cs` - Windows launcher source
- `build-exe.ps1` - Builds the Windows launcher
- `league-data.json` - Imported league data generated at runtime

## Disclaimer

This is an unofficial community project and is not affiliated with or endorsed by ESPN.
