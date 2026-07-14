import puppeteer from 'puppeteer';

(async () => {
  console.log('Starting puppeteer...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  await page.goto('http://localhost:5173/login');
  console.log('Navigated to login');
  
  // Wait for email input
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'admin@example.com');
  await page.type('input[type="password"]', 'password123'); // Assuming standard test credentials
  
  console.log('Clicking login...');
  await page.click('button[type="submit"]');
  
  // Wait for either dashboard or error
  await page.waitForTimeout(3000);
  
  const lsBefore = await page.evaluate(() => JSON.stringify(window.localStorage));
  console.log('LocalStorage after login:', lsBefore);
  
  console.log('Refreshing page...');
  await page.reload({ waitUntil: 'networkidle0' });
  
  const lsAfter = await page.evaluate(() => JSON.stringify(window.localStorage));
  console.log('LocalStorage after refresh:', lsAfter);
  
  const currentUrl = page.url();
  console.log('Current URL after refresh:', currentUrl);
  
  await browser.close();
})();
