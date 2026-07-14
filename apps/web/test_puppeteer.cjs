const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Go to localhost
  await page.goto('http://localhost:5173/');
  
  // See what is in localStorage before we do anything
  let ls = await page.evaluate(() => JSON.stringify(window.localStorage));
  console.log('Initial localStorage on page load:', ls);

  // Set a fake token
  await page.evaluate(() => {
    window.localStorage.setItem('sb-rujqejtisqermjyqqgoj-auth-token', '{"currentSession":{"access_token":"fake","expires_in":3600,"refresh_token":"fake","user":{"id":"fake"}}}');
  });

  // Reload the page
  await page.reload();

  // Wait a second for app to initialize
  await new Promise(r => setTimeout(r, 2000));

  // See what is in localStorage now
  ls = await page.evaluate(() => JSON.stringify(window.localStorage));
  console.log('localStorage after reload:', ls);

  await browser.close();
})();
