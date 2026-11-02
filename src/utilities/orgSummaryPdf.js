/* eslint-disable no-console */
const { openLoggedInBrowser } = require('./playwrightUtil');

const READY_SELECTOR = '[data-org-summary-ready="true"]';
const READY_TIMEOUT_MS = 90000;

const buildReportUrl = (baseUrl, period) => {
  const query = new URLSearchParams({
    comparison: period.comparison,
    from: period.from,
    to: period.to,
    compareFrom: period.compareFrom,
    compareTo: period.compareTo,
  });
  return `${baseUrl}/totalorgsummary?${query.toString()}`;
};

const PDF_HEIGHT_PADDING_PX = 40;

const renderOne = async (page, url, period) => {
  await page.goto(url, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector(READY_SELECTOR, { timeout: READY_TIMEOUT_MS });
  } catch (err) {
    throw new Error(`${period.label} report page never signalled ready (${READY_SELECTOR})`);
  }
  await page.emulateMedia({ media: 'screen' });
  const height = await page.evaluate(
    // eslint-disable-next-line no-undef
    () => document.documentElement.scrollHeight,
  );
  const buffer = await page.pdf({
    width: '1920px',
    height: `${height + PDF_HEIGHT_PADDING_PX}px`,
    printBackground: true,
    pageRanges: '1',
  });
  return { period, buffer };
};

/**
 * Renders one Total Org Summary PDF per report period using a single logged-in browser.
 * The page marks itself ready with data-org-summary-ready="true" once its data and charts
 * have loaded; without that marker the render fails instead of emailing a half-loaded report.
 */
const renderOrgSummaryPdfs = async (periods) => {
  const { REACT_FRONTEND_URL } = process.env;
  const { browser, page } = await openLoggedInBrowser();
  try {
    const pdfs = [];
    for (const period of periods) {
      // eslint-disable-next-line no-await-in-loop
      pdfs.push(await renderOne(page, buildReportUrl(REACT_FRONTEND_URL, period), period));
    }
    return pdfs;
  } finally {
    await browser.close();
  }
};

module.exports = { renderOrgSummaryPdfs, buildReportUrl, READY_SELECTOR };
