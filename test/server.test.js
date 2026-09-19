const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');

// PORT=0 asks the OS for a free port and NO_OPEN=1 keeps the viewer from
// opening a browser during tests. Both are read once, when server.js loads.
process.env.PORT = '0';
process.env.NO_OPEN = '1';

const { server, resolveLocalChatEndpoint, fetchWithTimeout } = require('../server.js');

const ready = server.listening
  ? Promise.resolve()
  : new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

test.after(() => new Promise((resolve) => server.close(resolve)));

// Sends one raw request so the path reaches the server exactly as written.
// HTTP clients normalize "/../" before sending, which would hide the bug this
// file guards against.
function rawGet(requestPath) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port: server.address().port, path: requestPath, method: 'GET', agent: false }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    request.on('error', reject);
    request.end();
  });
}

test('the local chat endpoint resolver accepts the shapes users type', () => {
  assert.equal(resolveLocalChatEndpoint('http://localhost:11434'), 'http://localhost:11434/chat/completions');
  assert.equal(resolveLocalChatEndpoint('http://localhost:11434/'), 'http://localhost:11434/chat/completions');
  assert.equal(resolveLocalChatEndpoint('http://localhost:11434/v1'), 'http://localhost:11434/v1/chat/completions');
  assert.equal(resolveLocalChatEndpoint('http://localhost:1234/v1/'), 'http://localhost:1234/v1/chat/completions');
  assert.equal(resolveLocalChatEndpoint('https://my-host.example.com/api/v1/chat/completions'), 'https://my-host.example.com/api/v1/chat/completions');
});

test('the local chat endpoint resolver rejects unusable base URLs', () => {
  assert.throws(() => resolveLocalChatEndpoint(''), { message: /Enter a custom base URL/ });
  assert.throws(() => resolveLocalChatEndpoint('   '), { message: /Enter a custom base URL/ });
  assert.throws(() => resolveLocalChatEndpoint('localhost:11434'), { message: /must start with http/ });
  assert.throws(() => resolveLocalChatEndpoint('ftp://localhost:11434'), { message: /must start with http/ });
});

test('fetchWithTimeout reports timeouts as a readable error', async () => {
  // A server that accepts connections but never answers, so the request can
  // only end through the timeout (undici blocks well-known ports like 9).
  const hanging = http.createServer(() => { /* never responds */ });
  await new Promise((resolve) => hanging.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(
      () => fetchWithTimeout(`http://127.0.0.1:${hanging.address().port}/hang`, {}, 50),
      { message: /timed out/ }
    );
  } finally {
    hanging.closeAllConnections();
    await new Promise((resolve) => hanging.close(resolve));
  }
});

test.before(async () => {
  await ready;
});

test('the viewer serves the dashboard from public/', async () => {
  const page = await rawGet('/');
  assert.equal(page.status, 200);
  assert.match(page.body, /Fantasy league viewer/);
  assert.match(page.headers['cache-control'], /no-store/);

  const script = await rawGet('/app.js');
  assert.equal(script.status, 200);
  assert.match(script.headers['content-type'], /text\/javascript/);
});

test('the viewer refuses paths that escape public/', async () => {
  for (const attempt of ['/../league-data.json', '/../package.json', '/../server.js', '/../.gitignore']) {
    const response = await rawGet(attempt);
    assert.equal(response.status, 403, `${attempt} must be forbidden`);
  }
});

test('the viewer refuses sibling folders that share the public prefix', async () => {
  // "public-backup" starts with "public", which used to pass the prefix check
  // and could serve files from outside the web root. It must stay forbidden.
  const response = await rawGet('/../public-backup/anything.js');
  assert.equal(response.status, 403);
});
