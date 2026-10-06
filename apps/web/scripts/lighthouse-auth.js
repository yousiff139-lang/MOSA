const puppeteer = require('puppeteer-core')
const lighthouse = require('lighthouse')
const { launch } = require('chrome-launcher')
const fs = require('fs');

async function run() {
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: process.env.CHROME_PATH
  })
  const page = await browser.newPage()
  
  // Login first
  console.log('Navigating to login page...');
  await page.goto('http://localhost:3000/auth/login')
  
  // Wait for inputs
  await page.waitForSelector('input[aria-label="اسم المستخدم"]');
  console.log('Logging in...');
  await page.type('input[aria-label="اسم المستخدم"]', 'admin')
  await page.type('input[aria-label="الرمز السري"]', '1234')
  await page.click('button[type="submit"]')
  
  console.log('Waiting for navigation...');
  await page.waitForNavigation()
  
  // Get cookies for lighthouse
  const cookies = await page.cookies()
  await browser.close()
  
  console.log('Login successful, cookies obtained');
  
  // Now run lighthouse
  console.log('Launching chrome for Lighthouse...');
  const chrome = await launch({
    chromeFlags: ['--headless'],
    chromePath: process.env.CHROME_PATH
  });
  
  const options = {
    logLevel: 'info',
    output: 'json',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    port: chrome.port
  };
  
  // Pass cookies to Lighthouse
  console.log('Running Lighthouse with authenticated session...');
  const runnerResult = await lighthouse('http://localhost:3000/dashboard', options, {
    extends: 'lighthouse:default',
    passes: [{
      passName: 'defaultPass',
      blankPage: 'about:blank',
      recordTrace: true,
      useThrottling: true,
      pauseAfterFcpMs: 1000,
      pauseAfterLoadMs: 1000,
      networkQuietThresholdMs: 1000,
      cpuQuietThresholdMs: 1000,
      gatherers: []
    }],
    settings: {
      extraHeaders: {
        Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; ')
      }
    }
  });

  // `.report` is the HTML report as a string
  const reportJson = runnerResult.report;
  fs.writeFileSync('lighthouse-auth-dashboard.json', reportJson);

  // Print results
  console.log('Lighthouse results:');
  for (const [key, value] of Object.entries(runnerResult.lhr.categories)) {
    console.log(`${key}: ${value.score}`);
  }

  await chrome.kill();
}

run().catch(console.error);
