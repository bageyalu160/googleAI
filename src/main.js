const { connect } = require('puppeteer-real-browser');
const { waitForHuman, randomDelay } = require('./behavior_utils');

async function testSite(page, name, url, checkFn) {
    console.log(`\n--- Testing ${name} ---`);
    try {
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
        console.log(`${name} loaded.`);

        // 模拟人类行为
        await waitForHuman(page);

        const screenshotPath = `${name.toLowerCase().replace(/\s/g, '_')}_report.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved to ${screenshotPath}`);

        if (checkFn) {
            const result = await checkFn(page);
            console.log(`${name} Result: ${result}`);
        }
    } catch (error) {
        console.error(`Error testing ${name}:`, error.message);
    }
}

(async () => {
    console.log('Starting advanced crawler test...');

    const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
    console.log(`Environment: ${isCI ? 'CI (GitHub Actions)' : 'Local'}`);

    // 构建启动参数
    const launchArgs = {
        headless: isCI ? 'auto' : false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,960'
        ],
        turnstile: true,      // 支持 Cloudflare Turnstile
        fingerprint: true,    // TLS 指纹伪造
        customConfig: {}
    };

    // 如果配置了代理,添加代理设置
    if (process.env.PROXY_URL) {
        console.log('Using proxy:', process.env.PROXY_URL.replace(/:[^:]+@/, ':****@'));
        launchArgs.args.push(`--proxy-server=${process.env.PROXY_URL}`);
    } else {
        console.log('No proxy configured (using direct connection)');
    }

    const { page, browser } = await connect(launchArgs);

    await page.setViewport({ width: 1280, height: 960 });

    // 添加初始随机延迟
    await randomDelay(1000, 3000);

    // 1. Sannysoft (Baseline)
    await testSite(page, 'Sannysoft', 'https://bot.sannysoft.com/', async (p) => {
        return await p.evaluate(() => {
            const el = document.querySelector('td#webdriver-result');
            return el ? el.textContent : 'Unknown';
        });
    });

    // 2. ReCAPTCHA Demo
    await testSite(page, 'ReCAPTCHA', 'https://www.google.com/recaptcha/api2/demo', async (p) => {
        // Check if the iframe exists
        const frame = await p.$('iframe[title="reCAPTCHA"]');
        return frame ? 'ReCAPTCHA Frame Found' : 'ReCAPTCHA Frame MISSING';
    });

    // 3. hCaptcha Demo
    await testSite(page, 'hCaptcha', 'https://accounts.hcaptcha.com/demo', async (p) => {
        const frame = await p.$('iframe[data-hcaptcha-widget-id]');
        return frame ? 'hCaptcha Frame Found' : 'hCaptcha Frame MISSING';
    });

    // 4. Stytch (nobots.dev)
    await testSite(page, 'Stytch', 'https://nobots.dev', async (p) => {
        // Wait a bit for analysis
        await randomDelay(2000, 4000);
        // Try to find the result text. The structure might vary, so we grab the main heading or status.
        // On nobots.dev, usually there is a "You are..." message.
        return await p.evaluate(() => {
            return document.body.innerText.includes('You are a human') ? 'PASSED (Human)' : 'POTENTIAL BOT DETECTED';
        });
    });

    await browser.close();
    console.log('\nAll tests completed.');
})();
