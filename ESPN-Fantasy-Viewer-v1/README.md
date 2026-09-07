# ESPN Fantasy League Viewer

A local ESPN Fantasy Football league importer and viewer. It opens a real browser for ESPN sign-in, imports private league data using your authenticated session, and serves it through a local web interface.

## Features

- Guided browser sign-in with Playwright
- Imports private ESPN Fantasy league data without hard-coding cookies
- Saves the imported response to `league-data.json`
- Provides a local web server and dashboard
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

A browser window will open. Sign in to ESPN, open the league home page, and click **Use this league**. The imported data will be saved to:

```text
league-data.json
```

## Run the Viewer

Start the local web server:

```powershell
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

The browser importer can also be started from the web interface when supported by the dashboard.

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
