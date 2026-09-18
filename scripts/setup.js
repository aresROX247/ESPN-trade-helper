// Friendly first-run setup and troubleshooting: `npm run setup` / `npm run doctor`.
// Also runs automatically as an npm postinstall step, where it must never fail.

const { checkEnvironment, installPlaywrightChromium, packageMetadata } = require('./environment');

const argv = process.argv.slice(2);
const isPostinstall = argv.includes('--postinstall');
const isVerbose = argv.includes('--verbose');
const wantsInstall = argv.includes('--install');

function line(text = '') {
  process.stdout.write(`${text}\n`);
}

function report(checks) {
  for (const check of checks) {
    line(`  ${check.ok ? '[ok]' : '[!!]'} ${check.name} - ${check.detail}`);
    if (!check.ok) line(`       Fix: ${check.fix}`);
  }
}

function main() {
  const { version } = packageMetadata();
  const environment = checkEnvironment();

  line('');
  line(`ESPN Fantasy League Viewer v${version} - setup check`);
  line('');
  report(environment.checks);
  line('');

  if (environment.ok) {
    line('Everything is ready. Start the viewer with: npm start');
    line('Import a league with: npm run browser');
    line('');
    return 0;
  }

  if (wantsInstall && !environment.browser) {
    line('No local browser was found, so Playwright Chromium will be installed now...');
    const result = installPlaywrightChromium();
    line(`${result.ok ? '[ok]' : '[!!]'} ${result.message}`);
    line('');
    const rechecked = checkEnvironment();
    if (rechecked.ok) {
      line('Setup is complete. Start the viewer with: npm start');
      line('');
      return 0;
    }
  }

  line('Finish the steps above, then run: npm run setup');
  line('Add --install to download Playwright Chromium automatically:');
  line('  node scripts/setup.js --install');
  if (isVerbose) {
    line('');
    line(`Platform: ${process.platform} ${process.arch}`);
    line('Verify the browser manually with: npx playwright install chromium');
  }
  line('');

  return isPostinstall ? 0 : 1;
}

const exitCode = main();
process.exitCode = exitCode;
