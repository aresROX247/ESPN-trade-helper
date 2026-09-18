#!/usr/bin/env node
// Single entry point for the whole tool.
//
//   espn-fantasy              check the environment, start the viewer, open it
//   espn-fantasy start        start the local viewer only
//   espn-fantasy import       open a browser and import a league (guided)
//   espn-fantasy refresh      re-import the saved league URL
//   espn-fantasy setup        verify Node, Playwright, and a usable browser
//   espn-fantasy doctor       same as setup, with extra platform details

const path = require('node:path');
const { spawn } = require('node:child_process');
const { checkEnvironment, openInBrowser, PACKAGE_ROOT } = require('../scripts/environment');

const PORT = process.env.PORT || 3000;
const command = (process.argv[2] || 'app').toLowerCase();
const passthrough = process.argv.slice(3);

function runScript(scriptName, args) {
  const child = spawn(process.execPath, [path.join(PACKAGE_ROOT, scriptName), ...args], {
    cwd: PACKAGE_ROOT,
    stdio: 'inherit',
  });
  child.on('close', (code) => {
    process.exitCode = code === null ? 1 : code;
  });
}

function warnAboutEnvironment() {
  const environment = checkEnvironment();
  if (environment.ok) return;
  process.stdout.write('\nEnvironment check found problems:\n');
  for (const check of environment.checks) {
    if (!check.ok) process.stdout.write(`  [!!] ${check.name} - ${check.detail}\n       Fix: ${check.fix}\n`);
  }
  process.stdout.write('\nRun "npm run setup" for a full report.\n\n');
}

switch (command) {
  case 'app':
  case 'start':
  case 'serve':
    warnAboutEnvironment();
    // "start" runs the viewer without stealing focus; "app" opens the dashboard.
    if (command !== 'app') process.env.NO_OPEN = '1';
    require(path.join(PACKAGE_ROOT, 'server.js'));
    break;

  case 'import':
  case 'browser':
    runScript('browser-import.js', passthrough);
    break;

  case 'refresh':
    runScript('browser-import.js', ['--refresh', ...passthrough]);
    break;

  case 'setup':
  case 'doctor':
    if (command === 'doctor' && !passthrough.includes('--verbose')) passthrough.push('--verbose');
    runScript(path.join('scripts', 'setup.js'), passthrough);
    break;

  case 'open':
    openInBrowser(`http://localhost:${PORT}`);
    process.stdout.write(`Opening http://localhost:${PORT}\n`);
    break;

  case 'help':
  case '--help':
  case '-h':
    process.stdout.write(
      [
        'ESPN Fantasy League Viewer',
        '',
        'Usage: espn-fantasy [command]',
        '',
        'Commands:',
        '  app        Start the viewer and open it in your browser (default)',
        '  start      Start the local viewer without opening a browser (NO_OPEN=1)',
        '  import     Open a browser and import a league from a URL',
        '  refresh    Re-import the saved league URL',
        '  setup      Check Node, Playwright, and browser readiness',
        '  doctor     Detailed troubleshooting report',
        '  open       Open the viewer in your default browser',
        '  help       Show this message',
        '',
      ].join('\n'),
    );
    break;

  default:
    process.stderr.write(`Unknown command: ${command}\nRun "espn-fantasy help" to list commands.\n`);
    process.exitCode = 1;
}
