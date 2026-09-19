const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { packageMetadata, openInBrowser } = require('./scripts/environment');

const PORT = process.env.PORT || 3000;
// The viewer opens itself in the default browser unless NO_OPEN=1 or CI is set.
const OPEN_ON_START = process.env.NO_OPEN !== '1' && !process.env.CI;
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
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    const error = new SyntaxError('Request body was not valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

// Resolves an OpenAI-compatible chat-completions endpoint from a user-supplied
// base URL. Accepts bare hosts ("http://localhost:11434"), versioned roots
// ("http://localhost:11434/v1"), and full endpoints that already end in
// "/chat/completions". Exported for unit tests via module.exports.
function resolveLocalChatEndpoint(baseUrl) {
  let normalizedBase = String(baseUrl || '').trim();
  while (normalizedBase.endsWith('/')) normalizedBase = normalizedBase.slice(0, -1);
  const lowerBase = normalizedBase.toLowerCase();
  if (!normalizedBase) throw new Error('Enter a custom base URL for the local model (for example http://localhost:11434/v1).');
  if (lowerBase.indexOf('http://') !== 0 && lowerBase.indexOf('https://') !== 0) {
    throw new Error('The local base URL must start with http:// or https://.');
  }
  if (lowerBase.endsWith('/chat/completions')) return normalizedBase;
  return `${normalizedBase}/chat/completions`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error('The request timed out. Check the model server and try again.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
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

async function requestAiTradeAnalysis({ apiKey, payload, useLocalModel, baseUrl, model }) {
  const normalizedModel = String(model || '').trim();
  const headers = { 'Content-Type': 'application/json' };
  const body = { temperature: 0.2, messages: [{ role: 'system', content: 'You are a fantasy football trade analyst. Use only the supplied players. Never invent players, stats, injuries, or roster rules. Return JSON with keys summary, tradeIdeas, waiverTargets. Each tradeIdeas item must have offer, receive, fit, whyItHelps, whyTheyAccept, risk. Each waiverTargets item must have player, action (TARGET, WATCH, or PASS), reason, fit. Keep recommendations concise and explain that they are decision support, not certainty.' }, { role: 'user', content: JSON.stringify(payload) }] };
  let endpoint;
  if (useLocalModel) {
    if (!normalizedModel) throw new Error('Enter the local model name to use.');
    endpoint = resolveLocalChatEndpoint(baseUrl);
    body.model = normalizedModel;
    // Local OpenAI-compatible servers such as Ollama may not support response_format.
    if (apiKey && apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
  } else {
    if (!apiKey || !apiKey.trim()) throw new Error('Add an OpenAI API key before using AI trade analysis.');
    endpoint = 'https://api.openai.com/v1/chat/completions';
    headers.Authorization = `Bearer ${apiKey.trim()}`;
    body.model = 'gpt-4o-mini';
    body.response_format = { type: 'json_object' };
  }
  const response = await fetchWithTimeout(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
  const responseBody = await response.json();
  if (!response.ok) throw new Error(responseBody.error?.message || `AI provider returned HTTP ${response.status}.`);
  const rawContent = responseBody.choices?.[0]?.message?.content || '{}';
  const cleaned = String(rawContent).split('```').join('').trim();
  const jsonStart = cleaned.indexOf('{');
  const arrayStart = cleaned.indexOf('[');
  const firstJson = jsonStart < 0 ? arrayStart : arrayStart < 0 ? jsonStart : Math.min(jsonStart, arrayStart);
  const candidate = firstJson >= 0 ? cleaned.slice(firstJson) : cleaned;
  try { return JSON.parse(candidate); } catch { throw new Error('AI returned an unreadable trade analysis.'); }
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

  if (request.method === 'POST' && request.url === '/api/ai/trades') {
    try {
      const body = await readRequestBody(request);
      const result = await requestAiTradeAnalysis(body);
      return sendJson(response, 200, result);
    } catch (error) {
      const statusCode = error instanceof SyntaxError ? 400 : 502;
      return sendJson(response, statusCode, { error: error.message });
    }
  }

  if (request.method === 'POST' && request.url === '/api/ai/test') {
    try {
      const body = await readRequestBody(request);
      const useLocalModel = Boolean(body.useLocalModel);
      const baseUrl = String(body.baseUrl || '').trim();
      const model = String(body.model || '').trim();
      const apiKey = String(body.apiKey || '').trim();
      let endpoint;
      if (useLocalModel) {
        if (!model) throw new Error('Enter the local model name to test.');
        endpoint = resolveLocalChatEndpoint(baseUrl);
      } else if (!apiKey) {
        throw new Error('Add an OpenAI API key before testing the connection.');
      } else {
        endpoint = 'https://api.openai.com/v1/models';
      }
      const headers = {};
      if (!useLocalModel || apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const check = await fetchWithTimeout(endpoint, { method: 'GET', headers }, 15000);
      if (!check.ok) {
        throw new Error(`The model server returned HTTP ${check.status}. Check the base URL, model name, API key, and that the server is running.`);
      }
      return sendJson(response, 200, { ok: true, endpoint });
    } catch (error) {
      const statusCode = error instanceof SyntaxError ? 400 : 502;
      return sendJson(response, statusCode, { error: error.message });
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

  if (request.method === 'GET' && request.url === '/api/version') {
    const { name, version } = packageMetadata();
    return sendJson(response, 200, { name, version });
  }

  const requestedPath = request.url === '/' ? '/index.html' : request.url;
  const filePath = path.resolve(PUBLIC_DIR, `.${requestedPath}`);
  // Compare against the trailing separator: a plain prefix check would also
  // accept sibling folders such as "public-backup" and serve files from them.
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    response.writeHead(403);
    return response.end('Forbidden');
  }

  const contentTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
  fs.readFile(filePath, (error, file) => {
    if (error) {
      response.writeHead(404);
      return response.end('Not found');
    }
    response.writeHead(200, { 'Content-Type': `${contentTypes[path.extname(filePath).toLowerCase()] || 'text/plain'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(file);
  });
});

// The bin launcher starts the viewer by requiring this file (not by running it
// as main), so the listen must happen unconditionally at require time.
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Close the existing viewer or open http://localhost:${PORT}.`);
  } else {
    console.error(`The local viewer could not start: ${error.message}`);
  }
  process.exitCode = 1;
});

server.listen(PORT, '127.0.0.1', () => {
  const viewerUrl = `http://localhost:${PORT}`;
  console.log(`ESPN Fantasy UI running at ${viewerUrl}`);
  if (OPEN_ON_START) openInBrowser(viewerUrl);
});

module.exports = { server, resolveLocalChatEndpoint, fetchWithTimeout };