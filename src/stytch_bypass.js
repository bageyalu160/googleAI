const { connect } = require('puppeteer-real-browser');
const { waitForHuman, randomDelay, humanMouseMove } = require('./behavior_utils');
const fs = require('fs');

const TRAP_ID = '4fd394a2-bc99-47c5-86d2-64414ee3d1db';

(async () => {
    console.log('🚀 Starting Stytch Bypass PoC...');

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
        console.log('🔒 Using proxy:', process.env.PROXY_URL.replace(/:[^:]+@/, ':****@'));
        launchArgs.args.push(`--proxy-server=${process.env.PROXY_URL}`);
    } else {
        console.log('⚠️  No proxy configured (TLS fingerprint may still be detected by advanced systems)');
    }

    const { page, browser } = await connect(launchArgs);

    await page.setViewport({ width: 1280, height: 960 });

    try {
        console.log('📍 Navigating to auth.augmentcode.com...');

        // Debug: Log all script requests
        page.on('request', req => {
            if (req.resourceType() === 'script') {
                console.log('📜 Script loaded:', req.url());
            }
        });

        // 初始延迟,模拟真实用户打开浏览器
        await randomDelay(1500, 3000);

        await page.goto('https://auth.augmentcode.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Handle redirect to main page (if app redirects to www)
        if (page.url().includes('www.augmentcode.com') || page.url().includes('login.augmentcode.com')) {
            console.log('🔄 Redirected to:', page.url());
        }

        console.log('✅ Page loaded. Simulating human behavior...');

        // 模拟人类行为
        await waitForHuman(page);

        console.log('📸 Taking debug screenshot...');
        await page.screenshot({ path: 'stytch_debug.png', fullPage: true });

        // Dump HTML
        const html = await page.content();
        fs.writeFileSync('stytch_page.html', html);
        console.log('💾 Saved HTML to stytch_page.html');

        // Check frames
        const frames = page.frames();
        console.log(`🖼️  Total frames: ${frames.length}`);
        for (const frame of frames) {
            console.log(`   Frame: ${frame.url()}`);
        }

        console.log('⏳ Waiting for window.GetTelemetryID...');
        // Wait for the function to be injected by the WASM loader
        await page.waitForFunction(() => typeof window.GetTelemetryID === 'function', { timeout: 10000 });
        console.log('🎯 GetTelemetryID function found!');

        // 再次模拟鼠标移动
        await humanMouseMove(page, 2);
        await randomDelay(500, 1500);

        console.log('⚙️  Executing GetTelemetryID()...');
        const start = Date.now();
        const telemetryId = await page.evaluate(async () => {
            return await window.GetTelemetryID();
        });
        const duration = Date.now() - start;

        console.log(`\n${'='.repeat(50)}`);
        console.log(`📊 Result (${duration}ms)`);
        console.log('🆔 Extracted ID:', telemetryId);

        if (telemetryId === TRAP_ID) {
            console.error('❌ FAILED: Trap ID detected! The WASM module detected the bot environment.');
        } else if (telemetryId && telemetryId.length > 20) {
            console.log('✅ SUCCESS: Valid Telemetry ID extracted!');
            console.log('🎉 TLS fingerprint bypass appears to be working!');
        } else {
            console.warn('⚠️  WARNING: ID format unexpected.');
        }
        console.log(`${'='.repeat(50)}\n`);

    } catch (error) {
        console.error('💥 Error during execution:', error.message);
        await page.screenshot({ path: 'stytch_error.png', fullPage: true });
        console.log('📸 Saved error screenshot to stytch_error.png');

        // Check if we are on a different page
        const url = page.url();
        console.log('📍 Current URL:', url);

        // Dump HTML on error too
        try {
            const html = await page.content();
            fs.writeFileSync('stytch_error.html', html);
            console.log('💾 Saved error HTML to stytch_error.html');
        } catch (e) {
            console.error('❌ Failed to save error HTML');
        }
    } finally {
        // Keep open for a moment to see
        await randomDelay(3000, 5000);
        await browser.close();
        console.log('👋 Browser closed.');
    }
})();
