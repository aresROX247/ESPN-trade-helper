// Shared environment helpers for setup, the CLI, the server, and the importer.
// Keeping browser detection in one place means every entry point behaves the same
// on Windows, macOS, and Linux.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');

const MIN_NODE_MAJOR = 20;
const PACKAGE_ROOT = path.join(__dirname, '..');

function nodeMajor() {
  return Number(process.versions.node.split('.')[0]);
}

function nodeVersionOk() {
  return nodeMajor() >= MIN_NODE_MAJOR;
}

function packageMetadata() {
  try {
    return JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  } catch {
    return { name: 'espn-fantasy-viewer', version: '0.0.0' };
  }
}

function hasPlaywright() {
  try {
    require.resolve('playwright');
    return true;
  } catch {
    return false;
  }
}

function bundledChromiumPath() {
  try {
    const { chromium } = require('playwright');
    const executable = chromium.executablePath();
    return executable && fs.existsSync(executable) ? executable : '';
  } catch {
    return '';
  }
}

// Resolve a bare command (for example "google-chrome") against PATH.
function findOnPath(command) {
  const directories = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : [''];
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${command}${extension}`);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        // Keep looking; missing directories are expected.
      }
    }
  }
  return '';
}

function browserCandidates() {
  const home = os.homedir();

  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA || '';
    return [
      {
        name: 'Microsoft Edge',
        files: [
          path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
          path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        ],
      },
      {
        name: 'Google Chrome',
        files: [
          path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
          path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
          localAppData && path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        ],
      },
    ];
  }

  if (process.platform === 'darwin') {
    return [
      {
        name: 'Google Chrome',
        files: [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          path.join(home, 'Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
        ],
      },
      {
        name: 'Microsoft Edge',
        files: ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
      },
    ];
  }

  return [
    { name: 'Google Chrome', commands: ['google-chrome', 'google-chrome-stable'] },
    { name: 'Chromium', commands: ['chromium', 'chromium-browser'] },
    { name: 'Microsoft Edge', commands: ['microsoft-edge', 'microsoft-edge-stable'] },
  ];
}

// Returns { name, executablePath } for the first usable browser, or null.
function findInstalledBrowser() {
  for (const candidate of browserCandidates()) {
    for (const file of (candidate.files || []).filter(Boolean)) {
      if (fs.existsSync(file)) return { name: candidate.name, executablePath: file };
    }
    for (const command of candidate.commands || []) {
      const resolved = findOnPath(command);
      if (resolved) return { name: candidate.name, executablePath: resolved };
    }
  }

  const bundled = bundledChromiumPath();
  if (bundled) return { name: 'Playwright Chromium', executablePath: bundled };

  return null;
}

function checkEnvironment() {
  const checks = [];
  const versionOk = nodeVersionOk();

  checks.push({
    name: `Node.js ${process.versions.node}`,
    ok: versionOk,
    detail: versionOk
      ? `meets the Node.js ${MIN_NODE_MAJOR}+ requirement`
      : `Node.js ${MIN_NODE_MAJOR} or newer is required`,
    fix: 'Install the current Node.js LTS from https://nodejs.org/en/download',
  });

  const playwrightInstalled = hasPlaywright();
  checks.push({
    name: 'Playwright dependency',
    ok: playwrightInstalled,
    detail: playwrightInstalled ? 'installed' : 'is missing, so the importer cannot start',
    fix: 'Run: npm install',
  });

  const browser = findInstalledBrowser();
  checks.push({
    name: browser ? `Browser: ${browser.name}` : 'Browser',
    ok: Boolean(browser),
    detail: browser ? 'ready for guided importing' : 'no supported browser was found',
    fix: 'Install Google Chrome or Microsoft Edge, or run: npx playwright install chromium',
  });

  return { ok: checks.every((check) => check.ok), checks, browser };
}

// Opens a URL in the default browser without pulling in an extra dependency.
function openInBrowser(url) {
  const platform = process.platform;
  const command = platform === 'win32' ? 'cmd' : platform === 'darwin' ? 'open' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

// Installs Playwright's own Chromium build by calling its CLI directly, so a
// locked-down PowerShell execution policy can never block setup.
function installPlaywrightChromium() {
  const cli = path.join(PACKAGE_ROOT, 'node_modules', 'playwright', 'cli.js');
  if (!fs.existsSync(cli)) {
    return { ok: false, message: 'Run npm install first, then try again.' };
  }
  const result = spawnSync(process.execPath, [cli, 'install', 'chromium'], { stdio: 'inherit' });
  return {
    ok: result.status === 0,
    message: result.status === 0 ? 'Playwright Chromium installed.' : 'Playwright Chromium could not be installed.',
  };
}

module.exports = {
  MIN_NODE_MAJOR,
  PACKAGE_ROOT,
  nodeMajor,
  nodeVersionOk,
  packageMetadata,
  hasPlaywright,
  findInstalledBrowser,
  checkEnvironment,
  openInBrowser,
  installPlaywrightChromium,
};
