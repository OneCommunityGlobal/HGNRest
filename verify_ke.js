const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  // 1. Main login
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"], input[name="email"]', 'anara082@ucr.edu');
  await page.fill('input[type="password"]', 'Amaresh@2001');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // 2. BM secondary login
  await page.goto('http://localhost:5173/bmdashboard/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.fill('input[name="email"]', 'anara082@ucr.edu');
  await page.fill('input[name="password"]', 'Amaresh@2001');
  await page.click('button:has-text("Submit")');
  await page.waitForTimeout(3000);

  // 3. Knowledge Evolution page - light mode
  await page.goto('http://localhost:5173/student/knowledge-evolution', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  console.log('KE URL:', page.url());

  await page.screenshot({ path: '/tmp/ke_light.png', fullPage: true });
  console.log('Light screenshot saved');

  // Verify content
  const bodyText = await page.textContent('body');
  console.log('Has "Knowledge Evolution":', bodyText.includes('Knowledge Evolution'));
  console.log('Has "Overall Progress":', bodyText.includes('Overall Progress'));
  console.log('Has stats box:', bodyText.includes('Total Completed'));
  console.log('Has legend:', bodyText.includes('Completed') && bodyText.includes('In Progress') && bodyText.includes('Not Started'));
  console.log('Has "Loading" stuck:', bodyText.includes('Loading Knowledge Evolution'));
  console.log('Has "Failed":', bodyText.includes('Failed to load'));

  const circles = await page.$$('svg circle');
  const lines = await page.$$('svg line');
  console.log('SVG circles:', circles.length, 'SVG lines:', lines.length);

  // 4. Dark mode via sun icon click
  const sunImg = await page.$('img[alt="Sun"]');
  if (sunImg) {
    await sunImg.click();
    await page.waitForTimeout(2000);
    console.log('Clicked sun icon (dark mode toggle)');
  } else {
    // Set via localStorage as fallback
    await page.evaluate(() => localStorage.setItem('darkMode', 'true'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    console.log('Set dark mode via localStorage');
  }
  await page.screenshot({ path: '/tmp/ke_dark.png', fullPage: true });
  console.log('Dark mode screenshot saved');

  // Verify dark mode applied to page container
  const darkContainer = await page.$('[class*="pageContainerDarkMode"]');
  console.log('Dark mode container present:', !!darkContainer);

  await browser.close();
})();
