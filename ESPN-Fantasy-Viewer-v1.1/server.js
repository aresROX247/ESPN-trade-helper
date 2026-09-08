const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const IMPORTED_DATA = path.join(__dirname, 'league-data.json');
let browserImporter = null;
let importerOutput = [];
let importerStatus = 'idle';

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

async function readRequestBody(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return JSON.parse(body || '{}');
}

async function fetchLeagueData({ leagueId, season, espnS2, swid }) {
  const endpoint = `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${encodeURIComponent(leagueId)}?view=mSettings&view=mTeam&view=mRoster&view=mMatchup`;
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      Cookie: `espn_s2=${espnS2}; SWID=${swid}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('ESPN rejected those cookies. Check ESPN_S2 and SWID.');
    }
    throw new Error(`ESPN returned HTTP ${response.status} ${response.statusText}.`);
  }

  return response.json();
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'POST' && request.url.startsWith('/api/browser-import/start')) {
    if (browserImporter && browserImporter.exitCode === null) {
      return sendJson(response, 409, { error: 'The browser importer is already running.' });
    }
    importerOutput = [];
    importerStatus = 'running';
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const refresh = requestUrl.searchParams.get('mode') === 'refresh';
    const leagueUrl = requestUrl.searchParams.get('url') || '';
    if (refresh && !fs.existsSync(IMPORTED_DATA)) {
      return sendJson(response, 400, { error: 'Import a league URL once before using Refresh data.' });
    }
    const importerArgs = [path.join(__dirname, 'browser-import.js')];
    if (refresh) importerArgs.push('--refresh');
    if (leagueUrl) importerArgs.push('--url', leagueUrl);
    browserImporter = spawn(process.execPath, importerArgs, { cwd: __dirname, windowsHide: false });
    browserImporter.stdout.on('data', (chunk) => importerOutput.push(chunk.toString()));
    browserImporter.stderr.on('data', (chunk) => importerOutput.push(chunk.toString()));
    browserImporter.on('close', (code) => {
      importerStatus = code === 0 ? 'complete' : 'error';
      importerOutput.push(code === 0 ? 'Import complete.' : 'Import stopped with an error.');
    });
    return sendJson(response, 202, { started: true });
  }

  if (request.method === 'GET' && request.url === '/api/browser-import/status') {
    return sendJson(response, 200, {
      running: Boolean(browserImporter && browserImporter.exitCode === null),
      status: importerStatus,
      output: importerOutput.join('').slice(-2000),
    });
  }

  if (request.method === 'POST' && request.url === '/api/imported/clear') {
    try {
      await fs.promises.unlink(IMPORTED_DATA);
      return sendJson(response, 200, { cleared: true });
    } catch (error) {
      if (error.code === 'ENOENT') return sendJson(response, 200, { cleared: true });
      return sendJson(response, 500, { error: 'Imported league data could not be cleared.' });
    }
  }

  if (request.method === 'GET' && request.url === '/api/imported') {
    try {
      const imported = JSON.parse(await fs.promises.readFile(IMPORTED_DATA, 'utf8'));
      return sendJson(response, 200, imported);
    } catch (error) {
      return sendJson(response, 404, { error: 'No imported league data found yet. Run the browser importer first.' });
    }
  }

  if (request.method === 'POST' && request.url === '/api/league') {
    try {
      const body = await readRequestBody(request);
      const { leagueId, season, espnS2, swid } = body;

      if (!leagueId || !season || !espnS2 || !swid) {
        return sendJson(response, 400, { error: 'League ID, season, ESPN_S2, and SWID are required.' });
      }

      const data = await fetchLeagueData({ leagueId, season, espnS2, swid });
      return sendJson(response, 200, data);
    } catch (error) {
      const statusCode = error instanceof SyntaxError ? 400 : 502;
      return sendJson(response, statusCode, { error: error.message });
    }
  }

  const requestedPath = request.url === '/' ? '/index.html' : request.url;
  const filePath = path.resolve(PUBLIC_DIR, `.${requestedPath}`);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    return response.end('Forbidden');
  }

  const contentTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
  fs.readFile(filePath, (error, file) => {
    if (error) {
      response.writeHead(404);
      return response.end('Not found');
    }
    response.writeHead(200, { 'Content-Type': `${contentTypes[path.extname(filePath)] || 'text/plain'}; charset=utf-8` });
    response.end(file);
  });
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Close the existing viewer or open http://localhost:${PORT}.`);
  } else {
    console.error(`The local viewer could not start: ${error.message}`);
  }
  process.exitCode = 1;
});

server.listen(PORT, () => {
  console.log(`ESPN Fantasy UI running at http://localhost:${PORT}`);
});