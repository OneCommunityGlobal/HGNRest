/* eslint-disable no-console */
const { execSync } = require('node:child_process');
// eslint-disable-next-line import/no-unresolved
const { chromium } = require('playwright');

async function ensureBrowserInstalled() {
  try {
    // Try launching once
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    await browser.close();
  } catch (err) {
    console.warn('Browser launch failed, attempting install...', err);

    try {
      // Force install without relying on .bin/playwright
      execSync('node node_modules/playwright/cli.js install chromium', {
        stdio: 'inherit',
      });
    } catch (installErr) {
      console.error('Playwright browser installation failed:', installErr);
      throw installErr;
    }
  }
}

// Pages a successful login never ends on: the account was rejected or must change its
// password first, so the report page would never load.
const LOGIN_BLOCKED_PATHS = ['/login', '/forcePasswordUpdate'];

const assertLoggedIn = (page) => {
  const { pathname } = new URL(page.url());
  if (LOGIN_BLOCKED_PATHS.some((blocked) => pathname.startsWith(blocked))) {
    throw new Error(
      `Playwright login did not reach the app (landed on ${pathname}). ` +
        'Check PUPPETEER_EMAIL and PUPPETEER_PASSWORD, and that the account has no pending password update.',
    );
  }
};

const openLoggedInBrowser = async () => {
  const { PUPPETEER_EMAIL, PUPPETEER_PASSWORD, REACT_FRONTEND_URL } = process.env;

  if (!PUPPETEER_EMAIL || !PUPPETEER_PASSWORD) {
    console.log('Playwright email or password not found in environment variables');
  }

  await ensureBrowserInstalled();

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    // Login page
    await page.goto(`${REACT_FRONTEND_URL}/login`, { waitUntil: 'networkidle' });

    await page.fill('input[id="email"]', PUPPETEER_EMAIL);
    await page.fill('input[id="password"]', PUPPETEER_PASSWORD);

    await page.click('.btn.btn-primary');

    // Wait for navigation after login
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    assertLoggedIn(page);

    return { browser, context, page };
  } catch (err) {
    await browser.close();
    throw err;
  }
};

const playwrightLogic = async () => {
  const { REACT_FRONTEND_URL } = process.env;
  let browser;
  try {
    const session = await openLoggedInBrowser();
    ({ browser } = session);
    const { page } = session;

    // Navigate to report page
    await page.goto(`${REACT_FRONTEND_URL}/totalorgsummary`, { waitUntil: 'networkidle' });

    // Wait for full load (instead of setTimeout)
    await page.waitForLoadState('networkidle');

    // Screenshot
    await page.screenshot({
      path: 'weeklyCompanySummary.png',
      fullPage: true,
    });

    await browser.close();
  } catch (err) {
    console.error('Playwright error:', err);
    if (browser) await browser.close();
    throw err;
  }
};

module.exports = playwrightLogic;
module.exports.openLoggedInBrowser = openLoggedInBrowser;
