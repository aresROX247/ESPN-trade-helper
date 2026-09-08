const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ESPN_HOME = 'https://fantasy.espn.com/football/';
const PROFILE_DIR = path.join(__dirname, '.espn-browser-profile');
const OUTPUT_FILE = path.join(__dirname, 'league-data.json');

function installedBrowser() {
  const candidates = [
    { channel: 'msedge', path: `${process.env['ProgramFiles(x86)'] || ''}\\Microsoft\\Edge\\Application\\msedge.exe` },
    { channel: 'msedge', path: `${process.env.ProgramFiles || ''}\\Microsoft\\Edge\\Application\\msedge.exe` },
    { executablePath: `${process.env.ProgramFiles || ''}\\Google\\Chrome\\Application\\chrome.exe` },
    { executablePath: `${process.env.LOCALAPPDATA || ''}\\Google\\Chrome\\Application\\chrome.exe` },
  ];
  return candidates.find((candidate) => fsSync.existsSync(candidate.path));
}

function findLeagueDetails(url) {
  const match = url.match(/(?:leagueId|leagues)\D*(\d+)/i) || url.match(/\/leagues\/(\d+)/i);
  const seasonMatch = url.match(/seasons?\/(\d{4})/i) || url.match(/season(?:Id)?=(\d{4})/i);
  return {
    leagueId: match?.[1] || '',
    season: seasonMatch?.[1] || String(new Date().getFullYear()),
  };
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || '' : '';
}

function validateLeagueUrl(value) {
  if (!value) return '';
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('The league URL is not valid. Paste the full ESPN Fantasy league URL.'); }
  if (parsed.protocol !== 'https:' || (parsed.hostname !== 'espn.com' && !parsed.hostname.endsWith('.espn.com'))) throw new Error('Use an HTTPS ESPN Fantasy league URL.');
  return parsed.toString();
}

async function addImportButton(page) {
  await page.evaluate(() => {
    if (document.querySelector('#espn-fantasy-import-button')) return;
    const button = document.createElement('button');
    button.id = 'espn-fantasy-import-button';
    button.textContent = 'Use this league';
    Object.assign(button.style, {
      position: 'fixed', zIndex: '2147483647', top: '18px', right: '18px',
      background: '#275a39', color: '#fff', border: '0', borderRadius: '6px',
      padding: '13px 18px', font: '700 15px Arial, sans-serif', cursor: 'pointer',
      boxShadow: '0 5px 18px rgba(0,0,0,.3)',
    });
    button.addEventListener('click', () => {
      window.__espnFantasyLeagueSelected = true;
      button.textContent = 'Pulling league...';
      button.disabled = true;
    });
    document.body.appendChild(button);
  });
}

async function pullLeague(page) {
  const leagueUrl = page.url();
  const { leagueId, season } = findLeagueDetails(leagueUrl);
  if (!leagueId) throw new Error('Could not find a league ID in the current URL. Open the league home page first.');

  const cookies = await page.context().cookies('https://fantasy.espn.com');
  const espnS2 = cookies.find((cookie) => cookie.name === 'espn_s2')?.value;
  const swid = cookies.find((cookie) => cookie.name === 'SWID')?.value;
  if (!espnS2 || !swid) throw new Error('ESPN_S2 or SWID was not found. Sign in to ESPN, then try again.');

  const endpointPath = `/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=mSettings&view=mTeam&view=mRoster&view=mMatchup&view=mAvailablePlayers`;
  const endpoints = [
    `https://fantasy.espn.com${endpointPath}`,
    `https://lm-api-reads.fantasy.espn.com${endpointPath}`,
  ];
  const apiPage = await page.context().newPage();
  let response;
  try {
    for (const endpoint of endpoints) {
      const apiResponse = await apiPage.goto(endpoint, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const candidate = {
        ok: apiResponse?.ok() || false,
        status: apiResponse?.status() || 0,
        contentType: apiResponse?.headers()['content-type'] || '',
        body: apiResponse ? await apiResponse.text() : '',
      };
      if (candidate.ok && candidate.contentType.includes('json') && !candidate.body.trim().startsWith('<')) {
        response = candidate;
        break;
      }
      response = candidate;
    }
  } finally {
    await apiPage.close();
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || response.body.includes('Sign In')) {
      throw new Error('ESPN did not accept the current sign-in. Sign in on the league page, then click “Use this league” again.');
    }
    throw new Error(`ESPN returned HTTP ${response.status}. Confirm you can view this league.`);
  }
  if (!response.contentType.includes('json') || response.body.trim().startsWith('<')) {
    throw new Error('ESPN returned a web page instead of league data. Make sure the league page is fully loaded and that you are signed in.');
  }

  let data;
  try {
    data = JSON.parse(response.body);
  } catch {
    throw new Error('ESPN returned an unreadable response. Refresh the league page and try again.');
  }
  await fs.writeFile(OUTPUT_FILE, JSON.stringify({ leagueId, season, leagueUrl, pulledAt: new Date().toISOString(), data }, null, 2));
  return { leagueId, season, leagueUrl, teamCount: data.teams?.length || 0 };
}

async function main() {
  const refresh = process.argv.includes('--refresh');
  const requestedUrl = validateLeagueUrl(argumentValue('--url'));
  let savedLeagueUrl = '';
  if (refresh) {
    try {
      const saved = JSON.parse(await fs.readFile(OUTPUT_FILE, 'utf8'));
      savedLeagueUrl = saved.leagueUrl || '';
    } catch {
      throw new Error('No previous league URL was found. Run the first import before refreshing.');
    }
    if (!savedLeagueUrl) throw new Error('No saved league URL was found. Run the first import before refreshing.');
  }
  const targetUrl = requestedUrl || savedLeagueUrl;
  const directImport = Boolean(targetUrl);
  console.log(directImport ? `Opening the requested ESPN Fantasy league: ${targetUrl}` : 'Opening ESPN Fantasy in a browser...');
  if (!directImport) console.log('Sign in, open your league page, then click the green “Use this league” button.');
  const browser = installedBrowser();
  if (!browser) {
    throw new Error('No supported browser was found. Install one with "npx playwright install chromium", then run this command again.');
  }
  const context = await chromium.launchPersistentContext(PROFILE_DIR, { ...browser, headless: false, args: ['--start-minimized'] });
  const page = context.pages()[0] || await context.newPage();
  await page.goto(directImport ? targetUrl : ESPN_HOME, { waitUntil: 'domcontentloaded' });

  while (!directImport && !page.isClosed()) {
    try { await addImportButton(page); } catch { /* Page may be changing during navigation. */ }
    try {
      if (await page.evaluate(() => window.__espnFantasyLeagueSelected === true)) break;
    } catch { /* Keep waiting while ESPN navigates. */ }
    await page.waitForTimeout(500);
  }

  try {
    const result = await pullLeague(page);
    console.log(`Pulled ${result.teamCount} teams from league ${result.leagueId} (${result.season}).`);
    console.log(`Saved league URL: ${result.leagueUrl}`);
    console.log(`Saved complete data to ${OUTPUT_FILE}`);
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(`Could not pull the league: ${error.message}`);
  process.exitCode = 1;
});