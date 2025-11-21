/**
 * 被拦截网站详细测试
 * 针对之前测试中被拦截的6个网站进行深度分析
 */
const { connect } = require('puppeteer-real-browser');
const { randomDelay, humanMouseMove } = require('./behavior_utils');
const AntiScrapingDetector = require('./anti_scraping_detector');

// 被拦截的网站列表
const BLOCKED_SITES = [
    { name: '微博', url: 'https://www.weibo.com', expectedIssue: '重定向到登录页' },
    { name: '新浪', url: 'https://www.sina.com.cn', expectedIssue: '机器人检测' },
    { name: '腾讯网', url: 'https://www.qq.com', expectedIssue: 'Cloudflare' },
    { name: '智联招聘', url: 'https://www.zhaopin.com', expectedIssue: '滑块验证码' },
    { name: '汽车之家', url: 'https://www.autohome.com.cn', expectedIssue: '安全验证' },
    { name: 'CSDN', url: 'https://www.csdn.net', expectedIssue: 'Cloudflare' }
];

async function detailedTest(page, detector, site) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🔍 详细测试: ${site.name}`);
    console.log(`🌐 URL: ${site.url}`);
    console.log(`⚠️  预期问题: ${site.expectedIssue}`);
    console.log(`${'='.repeat(70)}\n`);

    try {
        const responses = [];
        const responseHandler = (r) => responses.push(r);
        page.on('response', responseHandler);

        // 增加初始延迟
        await randomDelay(2000, 4000);

        console.log('📍 正在访问...');
        await page.goto(site.url, {
            waitUntil: 'domcontentloaded',
            timeout: 20000
        });

        page.off('response', responseHandler);

        // 模拟人类行为
        console.log('🖱️  模拟人类行为...');
        await humanMouseMove(page, 3);
        await randomDelay(1000, 2000);

        const finalUrl = page.url();
        console.log(`🔗 最终URL: ${finalUrl}`);

        // 选择主响应
        const hostname = new URL(site.url).hostname;
        const mainResponse = responses.find(r =>
            r.url() === site.url ||
            (r.url().includes(hostname) && r.request().resourceType() === 'document')
        ) || responses[0];

        if (!mainResponse) {
            console.log('❌ 未能捕获HTTP响应');
            return;
        }

        const httpStatus = mainResponse.status();
        console.log(`📊 HTTP 状态码: ${httpStatus}`);

        // 企业级检测
        console.log('\n🔬 运行企业级反爬检测...\n');
        const detection = await detector.detect(page, mainResponse, site.name);

        // 详细输出检测结果
        console.log('📋 检测结果:');
        console.log(`   状态: ${detection.isBlocked ? '❌ 被拦截' : '✅ 通过'}`);
        console.log(`   置信度: ${(detection.confidence * 100).toFixed(1)}%`);

        if (detection.reasons.length > 0) {
            console.log(`\n🚨 拦截原因 (${detection.reasons.length}个):`);
            detection.reasons.forEach((reason, i) => {
                console.log(`   ${i + 1}. ${reason}`);
            });
        }

        // 显示详细信息
        console.log('\n📊 详细信息:');

        if (detection.details.status) {
            console.log(`   HTTP 状态: ${JSON.stringify(detection.details.status)}`);
        }

        if (detection.details.content) {
            console.log(`   内容分析: 文本长度 ${detection.details.content.textLength} 字符`);
        }

        if (detection.details.dom?.elements) {
            const elements = detection.details.dom.elements;
            console.log('\n   🎯 检测到的元素:');

            if (elements.recaptcha.v2 || elements.recaptcha.v3) {
                console.log('      - reCAPTCHA (v2或v3)');
            }
            if (elements.hcaptcha.iframe || elements.hcaptcha.element) {
                console.log('      - hCaptcha');
            }
            if (elements.cloudflare.turnstile || elements.cloudflare.challenge) {
                console.log('      - Cloudflare Turnstile/Challenge');
            }
            if (elements.slider.geetest) {
                console.log('      - 极验滑块');
            }
            if (elements.slider.aliYun) {
                console.log('      - 阿里云滑块');
            }
            if (elements.slider.tencentCaptcha) {
                console.log('      - 腾讯验证码');
            }
            if (elements.generic.captchaImage) {
                console.log('      - 通用验证码图片');
            }
        }

        if (detection.details.redirect) {
            console.log('\n   🔄 重定向信息:');
            console.log(`      原始: ${detection.details.redirect.requestUrl}`);
            console.log(`      最终: ${detection.details.redirect.finalUrl}`);
        }

        // 截图
        const screenshotPath = `${site.name}_detailed.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`\n📸 截图已保存: ${screenshotPath}`);

        // 保存HTML
        const html = await page.content();
        const htmlPath = `${site.name}_detailed.html`;
        require('fs').writeFileSync(htmlPath, html);
        console.log(`💾 HTML已保存: ${htmlPath}`);

        // 页面文本预览
        const bodyText = await page.evaluate(() => document.body?.innerText || '');
        console.log(`\n📝 页面文本预览 (前300字符):`);
        console.log(`   ${bodyText.substring(0, 300).replace(/\n/g, ' ')}...`);

    } catch (error) {
        console.error(`\n💥 错误: ${error.message}`);
        try {
            const errorScreenshot = `${site.name}_error.png`;
            await page.screenshot({ path: errorScreenshot });
            console.log(`📸 错误截图: ${errorScreenshot}`);
        } catch (e) {
            // 忽略
        }
    }
}

(async () => {
    console.log('🚀 开始被拦截网站详细测试\n');
    console.log(`📊 测试网站数量: ${BLOCKED_SITES.length}`);
    console.log(`⏱️  每个网站额外等待时间用于深度分析\n`);

    const isCI = process.env.CI === 'true';
    const launchArgs = {
        headless: isCI ? 'auto' : false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,960',
            '--lang=zh-CN,zh'
        ],
        turnstile: true,
        fingerprint: true,
        customConfig: {}
    };

    if (process.env.PROXY_URL) {
        console.log('🔒 使用代理:', process.env.PROXY_URL.replace(/:[^:]+@/, ':****@'));
        launchArgs.args.push(`--proxy-server=${process.env.PROXY_URL}`);
    } else {
        console.log('ℹ️  未配置代理 (直连)\n');
    }

    const { page, browser } = await connect(launchArgs);
    await page.setViewport({ width: 1280, height: 960 });
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    });

    const detector = new AntiScrapingDetector({
        verbose: true,
        saveDebugInfo: false
    });

    for (let i = 0; i < BLOCKED_SITES.length; i++) {
        await detailedTest(page, detector, BLOCKED_SITES[i]);

        // 测试间延迟
        if (i < BLOCKED_SITES.length - 1) {
            console.log('\n⏳ 等待5秒后测试下一个网站...\n');
            await randomDelay(5000, 7000);
        }
    }

    await browser.close();
    console.log('\n✅ 所有详细测试完成!');
})();
