const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('release metadata is v1.1.0', () => {
  const packageData = JSON.parse(read('package.json'));
  assert.equal(packageData.version, '1.1.0');
  assert.equal(packageData.scripts.test, 'node --test');
});

test('viewer does not save ESPN cookies in saved profiles', () => {
  const app = read('public/app.js');
  assert.match(app, /item\.leagueUrl/);
  assert.match(app, /data\.settings\?\.name/);
  assert.match(app, /league\.name/);
  assert.match(app, /lineupSlotNames/);
  assert.match(app, /rosterSection/);
  assert.match(app, /showPlayerDetails/);
  assert.match(app, /lastSeasonPoints/);
  assert.match(app, /fitTier/);
  assert.match(app, /scoreBreakdown/);
  assert.doesNotMatch(app, /espnS2|SWID/);
});

test('server exposes imported-data clearing and importer status', () => {
  const server = read('server.js');
  assert.match(server, /\/api\/imported\/clear/);
  assert.match(server, /status: importerStatus/);
  assert.match(server, /searchParams\.get\('mode'\)/);
  assert.match(server, /EADDRINUSE/);
  assert.match(server, /Import a league URL once before using Refresh data/);
  assert.match(server, /\/api\/ai\/trades/);
  assert.match(server, /api\.openai\.com\/v1\/chat\/completions/);
});

test('browser importer saves and reuses the exact league URL', () => {
  const importer = read('browser-import.js');
  assert.match(importer, /leagueUrl/);
  assert.match(importer, /process\.argv\.includes\('--refresh'\)/);
  assert.match(importer, /argumentValue\('--url'\)/);
  assert.match(importer, /page\.goto\(directImport \? targetUrl : ESPN_HOME/);
  assert.match(importer, /args: \['--start-minimized'\]/);
});

test('viewer contains the v1.1 league tools', () => {
  const page = read('public/index.html');
  const app = read('public/app.js');
  assert.match(page, /id="standings"/);
  assert.match(page, /id="team-search"/);
  assert.match(page, /id="clear-data-button"/);
  assert.match(page, /id="avoid-injured"/);
  assert.match(page, /id="trade-shape"/);
  assert.match(page, /id="league-url"/);
  assert.match(page, /id="player-dialog"/);
  assert.match(page, /id="ai-trade-panel"/);
  assert.match(page, /id="waiver-sidebar"/);
  assert.match(page, /35\+ is an excellent fit/);
  assert.match(app, /browserImportButton\.addEventListener\('click', \(\) => startBrowserImport\(false\)\)/);
  assert.doesNotMatch(page, /name="leagueId"|name="season"|name="espnS2"|name="swid"/);
});
