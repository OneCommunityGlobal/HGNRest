/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CACHE_DIR = '/home/puppeteer-cache';
const LOCK_FILE = path.join(CACHE_DIR, 'install.lock');

function ensureChromeInstalled() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  const chromeBase = path.join(CACHE_DIR, 'chrome');

  let isInstalled = false;

  if (fs.existsSync(chromeBase)) {
    const folders = fs.readdirSync(chromeBase);
    isInstalled = folders.length > 0;
  }

  if (!isInstalled) {
    if (fs.existsSync(LOCK_FILE)) {
      console.log('Chrome installation already in progress...');
      return;
    }

    fs.writeFileSync(LOCK_FILE, 'installing');

    try {
      console.log('Installing Chrome...');
      execFileSync('npx', ['puppeteer', 'browsers', 'install', 'chrome'], {
        stdio: 'inherit',
        env: {
          ...process.env,
          PUPPETEER_CACHE_DIR: CACHE_DIR,
        },
      });
      console.log('Chrome installed');
    } catch (err) {
      console.error('Chrome installation failed:', err);
    } finally {
      if (fs.existsSync(LOCK_FILE)) {
        fs.unlinkSync(LOCK_FILE);
      }
    }
  }
}

function getChromeExecutable() {
  ensureChromeInstalled();

  const chromeBase = path.join(CACHE_DIR, 'chrome');

  if (!fs.existsSync(chromeBase)) {
    throw new Error('Chrome base directory not found');
  }

  const folders = fs.readdirSync(chromeBase);

  if (!folders.length) {
    throw new Error('No Chrome installation found');
  }

  const latest = folders.sort().reverse()[0];

  const chromePath = path.join(chromeBase, latest, 'chrome-linux64', 'chrome');

  console.log('Using Chrome at:', chromePath);

  return chromePath;
}

module.exports = { getChromeExecutable };
