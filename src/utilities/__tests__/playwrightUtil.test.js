jest.mock('playwright', () => ({ chromium: { launch: jest.fn() } }), { virtual: true });

const { chromium } = require('playwright');
const { openLoggedInBrowser } = require('../playwrightUtil');

const fakeBrowser = (landedUrl) => {
  const page = {
    goto: jest.fn(),
    fill: jest.fn(),
    click: jest.fn(),
    waitForNavigation: jest.fn(),
    url: jest.fn(() => landedUrl),
  };
  const browser = {
    close: jest.fn(),
    newContext: jest.fn(async () => ({ newPage: async () => page })),
  };
  chromium.launch.mockResolvedValue(browser);
  return { browser, page };
};

describe('openLoggedInBrowser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PUPPETEER_EMAIL = 'render@x.org';
    process.env.PUPPETEER_PASSWORD = 'secret';
    process.env.REACT_FRONTEND_URL = 'http://localhost:5173';
  });

  it('returns the page once login lands inside the app', async () => {
    const { page } = fakeBrowser('http://localhost:5173/dashboard/abc');
    const result = await openLoggedInBrowser();
    expect(result.page).toBe(page);
  });

  it.each([
    ['http://localhost:5173/forcePasswordUpdate/6abb3feb', /forcePasswordUpdate/],
    ['http://localhost:5173/login', /\/login/],
  ])('fails fast and closes the browser when login lands on %s', async (landedUrl, pattern) => {
    const { browser } = fakeBrowser(landedUrl);
    await expect(openLoggedInBrowser()).rejects.toThrow(pattern);
    expect(browser.close).toHaveBeenCalled();
  });
});
