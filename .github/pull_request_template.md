## What changed

Describe the change and the user-facing effect.

## Why

Link the issue this closes, if there is one.

## Checklist

- [ ] `npm test` passes locally
- [ ] `node --check` passes for every file I touched
- [ ] `test/smoke.test.js` was updated if I changed a covered script name, user-facing string, or the version
- [ ] I did not commit `.espn-browser-profile/`, `league-data.json`, or any ESPN cookies
- [ ] I did not add a runtime dependency beyond `playwright`
- [ ] Anything install-related still works on Windows, macOS, and Linux
- [ ] C# changes in `ESPNFantasyImporter.cs` stay C# 5 compatible for `Add-Type`
- [ ] README and CHANGELOG were updated when behavior changed

## How I verified it

Paste the commands you ran and what you saw.