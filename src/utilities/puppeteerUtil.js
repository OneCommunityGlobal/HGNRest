const puppeteer = require('puppeteer');

function getChromeExecutable() {
  const executablePath = puppeteer.executablePath();
  console.log('Using Chrome at:', executablePath);
  return executablePath;
}

module.exports = { getChromeExecutable };
