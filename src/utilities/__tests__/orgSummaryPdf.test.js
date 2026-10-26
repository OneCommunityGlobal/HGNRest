jest.mock('../playwrightUtil', () => ({ openLoggedInBrowser: jest.fn() }));

const { openLoggedInBrowser } = require('../playwrightUtil');
const { renderOrgSummaryPdfs, buildReportUrl } = require('../orgSummaryPdf');

const period = {
  label: 'Week-over-Week',
  comparison: 'Week Over Week',
  from: '2026-10-18',
  to: '2026-10-24',
  compareFrom: '2026-10-11',
  compareTo: '2026-10-17',
};

describe('orgSummaryPdf', () => {
  beforeEach(() => {
    process.env.REACT_FRONTEND_URL = 'https://app.example.org';
    jest.clearAllMocks();
  });

  it('builds the report URL with explicit current and comparison dates', () => {
    const url = new URL(buildReportUrl('https://app.example.org', period));
    expect(url.pathname).toBe('/totalorgsummary');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      comparison: 'Week Over Week',
      from: '2026-10-18',
      to: '2026-10-24',
      compareFrom: '2026-10-11',
      compareTo: '2026-10-17',
    });
  });

  it('renders one PDF per period and always closes the browser', async () => {
    const page = {
      goto: jest.fn().mockResolvedValue(),
      waitForSelector: jest.fn().mockResolvedValue(),
      emulateMedia: jest.fn().mockResolvedValue(),
      evaluate: jest.fn().mockResolvedValue(2000),
      pdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
    };
    const browser = { close: jest.fn().mockResolvedValue() };
    openLoggedInBrowser.mockResolvedValue({ browser, page });

    const result = await renderOrgSummaryPdfs([period, period]);

    expect(result).toHaveLength(2);
    expect(page.goto).toHaveBeenCalledTimes(2);
    expect(page.pdf).toHaveBeenCalledWith(expect.objectContaining({ printBackground: true }));
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it('fails instead of emailing a page that never signalled ready', async () => {
    const page = {
      goto: jest.fn().mockResolvedValue(),
      waitForSelector: jest.fn().mockRejectedValue(new Error('timeout')),
    };
    const browser = { close: jest.fn().mockResolvedValue() };
    openLoggedInBrowser.mockResolvedValue({ browser, page });

    await expect(renderOrgSummaryPdfs([period])).rejects.toThrow(/never signalled ready/);
    expect(browser.close).toHaveBeenCalledTimes(1);
  });
});
