# Contributing

Thanks for helping improve the ESPN Fantasy League Viewer. This project is a local-only tool, so the guiding rule is simple: **nothing should ever leave the user's computer unless they asked for it.**

## Getting set up

```bash
npm install
npm run setup     # verifies Node, Playwright, and a usable browser
npm test
```

## Before you open a pull request

```bash
npm test
node --check browser-import.js
node --check server.js
node --check public/app.js
node --check bin/espn-fantasy.js
node --check scripts/environment.js
node --check scripts/setup.js
```

`npm test` runs the smoke tests in `test/`. They assert the privacy guarantees, the importer entry points, and the presence of key viewer controls. If you change a script name, a user-facing string that the tests cover, or a `package.json` version, update `test/smoke.test.js` in the same pull request.

## Project layout

| Path | Purpose |
| --- | --- |
| `browser-import.js` | Opens the authenticated browser and pulls league data |
| `server.js` | Local API plus static viewer hosting |
| `public/` | Viewer interface (`index.html`, `app.js`, `styles.css`) |
| `bin/espn-fantasy.js` | Single CLI entry point (`app`, `import`, `refresh`, `setup`, `doctor`) |
| `scripts/environment.js` | Shared Node, Playwright, and browser detection |
| `scripts/setup.js` | Setup and troubleshooting report, used by `postinstall` |
| `install.ps1` / `install.sh` | One-step installers |
| `ESPNFantasyImporter.cs` | Windows launcher source, built by `build-exe.ps1` |

## Guidelines

- Keep the project dependency-light. `playwright` is the only runtime dependency; prefer the Node standard library for anything new.
- Never add a runtime dependency that sends league data to a third party without an explicit, opt-in user action.
- Keep user-facing messages actionable: say what failed and what to run next.
- Match the existing style: two-space indentation, single quotes, semicolons, small focused functions.
- Keep the Windows launcher C# 5 compatible. `build-exe.ps1` compiles it with `Add-Type`, which does not support string interpolation, `?.`, or expression-bodied members.
- Support Windows, macOS, and Linux in anything install-related.

## Reporting bugs

Use the issue templates. `npm run doctor` output plus your operating system and browser name solves most problems before the first reply.