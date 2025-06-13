const { chromium } = require('playwright');
const fs = require('fs');

const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Turnstile Solver</title>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async></script>
</head>
<body>
    <!-- cf turnstile -->
</body>
</html>`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = val;
        i++;
      }
    }
  }
  return args;
}

async function solve(options) {
  const {
    url,
    sitekey,
    action,
    cdata,
    headless = false,
    useragent,
    debug = false,
    browser_type = 'chromium'
  } = options;

  const launchOptions = { headless: headless, args: [] };
  if (useragent) {
    launchOptions.args.push(`--user-agent=${useragent}`);
  }

  if (browser_type === 'chrome') {
    launchOptions.channel = 'chrome';
  } else if (browser_type === 'msedge') {
    launchOptions.channel = 'msedge';
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext();
  const page = await context.newPage();

  const urlWithSlash = url.endsWith('/') ? url : url + '/';
  const turnstileDiv = `<div class="cf-turnstile" data-sitekey="${sitekey}"${action ? ` data-action="${action}"` : ''}${cdata ? ` data-cdata="${cdata}"` : ''}></div>`;
  const html = HTML_TEMPLATE.replace('<!-- cf turnstile -->', turnstileDiv);

  await page.route(urlWithSlash, route => route.fulfill({ body: html, status: 200, contentType: 'text/html' }));

  const start = Date.now();
  await page.goto(urlWithSlash);

  let token = null;
  for (let i = 0; i < 10; i++) {
    try {
      const value = await page.locator('[name=cf-turnstile-response]').inputValue();
      if (value) {
        token = value;
        break;
      }
      await page.click('div.cf-turnstile');
    } catch (err) {
      if (debug) console.error('Attempt error:', err);
    }
    await page.waitForTimeout(500);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(3);
  await browser.close();
  return { value: token, elapsed_time: Number(elapsed) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url || !args.sitekey) {
    console.error('Usage: node node_solver.js --url <url> --sitekey <key> [--headless] [--useragent UA]');
    process.exit(1);
  }

  try {
    const result = await solve(args);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
