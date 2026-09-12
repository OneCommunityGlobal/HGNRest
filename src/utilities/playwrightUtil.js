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

const playwrightLogic = async () => {
  try {
    const { PUPPETEER_EMAIL, PUPPETEER_PASSWORD, REACT_FRONTEND_URL } = process.env;

    if (!PUPPETEER_EMAIL || !PUPPETEER_PASSWORD) {
      console.log('Playwright email or password not found in environment variables');
    }

    await ensureBrowserInstalled();

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

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
    throw err;
  }
};

module.exports = playwrightLogic;
