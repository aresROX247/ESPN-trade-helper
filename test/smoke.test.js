const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('release metadata is v1.3.0', () => {
  const packageData = JSON.parse(read('package.json'));
  assert.equal(packageData.version, '1.3.0');
  assert.equal(packageData.scripts.test, 'node --test');
  assert.equal(packageData.engines.node, '>=20');
  assert.equal(packageData.bin['espn-fantasy'], 'bin/espn-fantasy.js');
  assert.match(packageData.scripts.postinstall, /scripts\/setup\.js --postinstall/);
  assert.match(packageData.scripts.start, /bin\/espn-fantasy\.js start/);
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

test('installation helpers ship together', () => {
  const helpers = [
    'install.ps1',
    'install.sh',
    'Start Viewer.cmd',
    'Import League.cmd',
    'bin/espn-fantasy.js',
    'scripts/environment.js',
    'scripts/setup.js',
    '.nvmrc',
    'CONTRIBUTING.md',
    'SECURITY.md',
    '.github/pull_request_template.md',
    '.github/workflows/release.yml',
  ];
  for (const helper of helpers) {
    assert.ok(fs.existsSync(path.join(root, helper)), `${helper} should exist`);
  }
});

test('browser detection is shared and cross-platform', () => {
  const environment = read('scripts/environment.js');
  assert.match(environment, /findInstalledBrowser/);
  assert.match(environment, /ProgramFiles\(x86\)/);
  assert.match(environment, /darwin/);
  assert.match(environment, /xdg-open/);
  assert.match(environment, /MIN_NODE_MAJOR = 20/);

  const importer = read('browser-import.js');
  assert.match(importer, /require\('\.\/scripts\/environment'\)/);
  assert.doesNotMatch(importer, /fsSync/);

  const cli = read('bin/espn-fantasy.js');
  assert.match(cli, /case 'refresh'/);
  assert.match(cli, /case 'doctor'/);
  assert.match(cli, /NO_OPEN = '1'/);

  const setup = read('scripts/setup.js');
  assert.match(setup, /--postinstall/);
  assert.match(setup, /--install/);
});

test('viewer opens itself and reports its version', () => {
  const server = read('server.js');
  assert.match(server, /\/api\/version/);
  assert.match(server, /NO_OPEN/);
  assert.match(server, /openInBrowser\(viewerUrl\)/);
});

test('environment helpers describe this machine', () => {
  const environment = require('../scripts/environment');
  assert.equal(environment.MIN_NODE_MAJOR, 20);
  assert.equal(environment.nodeVersionOk(), true);
  assert.equal(environment.hasPlaywright(), true);
  assert.equal(typeof environment.openInBrowser, 'function');

  const result = environment.checkEnvironment();
  assert.equal(result.checks.length, 3);
  assert.equal(typeof result.ok, 'boolean');
  if (result.browser) {
    assert.equal(typeof result.browser.executablePath, 'string');
    assert.ok(result.browser.name.length > 0);
  }
});

test('repository metadata points at the published GitHub repo', () => {
  const packageData = JSON.parse(read('package.json'));
  assert.equal(packageData.repository.url, 'git+https://github.com/aresROX247/ESPN-trade-helper.git');
  assert.equal(packageData.bugs.url, 'https://github.com/aresROX247/ESPN-trade-helper/issues');
  assert.match(packageData.homepage, /aresROX247\/ESPN-trade-helper/);

  const readme = read('README.md');
  assert.match(readme, /git clone https:\/\/github\.com\/aresROX247\/ESPN-trade-helper\.git/);
  assert.doesNotMatch(readme, /github\.com\/OWNER/);

  const issueConfig = read('.github/ISSUE_TEMPLATE/config.yml');
  assert.doesNotMatch(issueConfig, /OWNER/);
  assert.match(issueConfig, /aresROX247\/ESPN-trade-helper/);
});

test('the Trade Lab exposes a live trade review dropdown', () => {
  const page = read('public/index.html');
  assert.match(page, /id="pending-trades"/);
  assert.match(page, /id="pending-trade-select"/);
  assert.match(page, /id="pending-trade-detail"/);
  assert.match(page, /id="pending-trades-count"/);
  assert.match(page, /src="\/trade-review\.js"/);

  const app = read('public/app.js');
  assert.match(app, /TradeReview\.collectPendingTrades/);
  assert.match(app, /TradeReview\.evaluateIncomingTrade/);
  assert.match(app, /Waiting on your answer/);
  assert.match(app, /Sent by you \(not scored\)/);
  assert.match(app, /pendingTradeSelect\.addEventListener\('change'/);

  const importer = read('browser-import.js');
  assert.match(importer, /view=mPendingTransactions/);

  const review = read('public/trade-review.js');
  assert.match(review, /function collectPendingTrades/);
  assert.match(review, /function evaluateIncomingTrade/);
  assert.match(review, /if \(trade\.proposerId === teamId\) sent\.push\(trade\)/);
});
