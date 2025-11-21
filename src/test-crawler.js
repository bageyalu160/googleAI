/**
 * 反爬虫检测测试脚本
 * 
 * 测试爬虫绕过各种机器人检测系统的能力。
 * 使用 BrowserManager 以保持行为一致性。
 */

const BrowserManager = require('./core/browser-manager');
const { waitForHuman, randomDelay } = require('./core/behavior-simulator');
const { logger } = require('./utils/logger');

async function testSite(page, name, url, checkFn) {
    logger.info(`\n--- 正在测试 ${name} ---`);
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        logger.info(`${name} 加载完成。`);

        // 模拟人类行为
        await waitForHuman(page);

        const screenshotPath = `reports/${name.toLowerCase().replace(/\s/g, '_')}_report.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        logger.info(`截图已保存至 ${screenshotPath}`);

        if (checkFn) {
            const result = await checkFn(page);
            logger.success(`${name} 结果: ${result}`);
        }
    } catch (error) {
        logger.error(`测试 ${name} 时出错:`, error.message);
    }
}

(async () => {
    logger.info('开始高级爬虫测试...');

    const browserManager = new BrowserManager({
        headless: 'auto', // 让 BrowserManager 自动检测环境
        turnstile: true,
        fingerprint: true
    });

    try {
        const { page, browser } = await browserManager.init();

        // 1. Sannysoft (基准测试)
        await testSite(page, 'Sannysoft', 'https://bot.sannysoft.com/', async (p) => {
            return await p.evaluate(() => {
                const el = document.querySelector('td#webdriver-result');
                return el ? el.textContent : '未知';
            });
        });

        // 2. ReCAPTCHA 演示
        await testSite(page, 'ReCAPTCHA', 'https://www.google.com/recaptcha/api2/demo', async (p) => {
            const frame = await p.$('iframe[title="reCAPTCHA"]');
            return frame ? '发现 ReCAPTCHA 框架' : '未发现 ReCAPTCHA 框架';
        });

        // 3. hCaptcha 演示
        await testSite(page, 'hCaptcha', 'https://accounts.hcaptcha.com/demo', async (p) => {
            const frame = await p.$('iframe[data-hcaptcha-widget-id]');
            return frame ? '发现 hCaptcha 框架' : '未发现 hCaptcha 框架';
        });

        // 4. Stytch (nobots.dev)
        await testSite(page, 'Stytch', 'https://nobots.dev', async (p) => {
            await randomDelay(2000, 4000);
            return await p.evaluate(() => {
                return document.body.innerText.includes('You are a human') ? '通过 (人类)' : '检测到潜在机器人';
            });
        });

    } catch (error) {
        logger.error('致命错误:', error);
    } finally {
        await browserManager.close();
        logger.info('\n所有测试已完成。');
    }
})();
