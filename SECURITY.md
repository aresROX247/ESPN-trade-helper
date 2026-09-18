# Security Policy

## Please never share these files

| File or folder | Why it is sensitive |
| --- | --- |
| `.espn-browser-profile/` | Contains a live, signed-in ESPN browser session |
| `league-data.json` | Contains your private league, team, owner, and roster data |
| `.env`, `.npmrc` | Can contain personal tokens or registry credentials |

These paths are already listed in `.gitignore`. Before you open an issue, a pull request, or a screenshot, confirm none of them are attached. Redact league names and owner names if you share importer output.

## Why the tool avoids cookies on purpose

Version 1.1.0 removed manual ESPN cookie entry. The viewer never writes `espn_s2` or `SWID` into `league-data.json`, and saved league profiles contain only the league URL, league ID, season, and league name. Cookies stay inside the local Chromium profile that Playwright launches.

If you find a path where an ESPN cookie, an OpenAI API key, or private league data can be written to a file, a log, or an HTTP response, that is a security bug. Please report it privately.

## Reporting a vulnerability

1. Use GitHub's **Report a vulnerability** button on the **Security** tab so the report stays private.
2. Include the version from `npm run doctor`, your operating system, and the smallest reproduction you can manage.
3. Do not include real ESPN cookies, real league data, or your OpenAI API key.

We aim to acknowledge reports within a few days. Because this is an unofficial community project, please allow reasonable time for a fix before disclosing publicly.

## Supported versions

Only the latest released version receives security fixes.