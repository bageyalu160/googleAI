/**
 * 企业级反爬检测模块
 * 参考 GitHub 开源项目最佳实践:
 * - @fingerprintjs/botd
 * - rebrowser-bot-detector
 * - puppeteer-extra-plugin-stealth
 */

const fs = require('fs');

/**
 * 反爬检测结果
 * @typedef {Object} DetectionResult
 * @property {boolean} isBlocked - 是否被拦截
 * @property {number} confidence - 置信度 (0-1)
 * @property {string[]} reasons - 检测原因列表
 * @property {Object} details - 详细信息
 */

class AntiScrapingDetector {
    constructor(options = {}) {
        this.verbose = options.verbose || false;
        this.saveDebugInfo = options.saveDebugInfo || false;
    }

    /**
     * 综合检测页面响应是否被反爬拦截
     * @param {Object} page - Puppeteer page 对象
     * @param {Object} response - HTTP response 对象
     * @param {string} siteName - 网站名称 (用于日志)
     * @returns {Promise<DetectionResult>}
     */
    async detect(page, response, siteName = 'unknown') {
        const result = {
            isBlocked: false,
            confidence: 0,
            reasons: [],
            details: {}
        };

        // 1. HTTP 状态码检测
        const statusCheck = this._checkHttpStatus(response);
        if (statusCheck.blocked) {
            result.isBlocked = true;
            result.confidence = Math.max(result.confidence, statusCheck.confidence);
            result.reasons.push(...statusCheck.reasons);
            result.details.status = statusCheck.details;
        }

        // 2. HTTP 响应头检测
        const headerCheck = this._checkHeaders(response);
        if (headerCheck.blocked) {
            result.isBlocked = true;
            result.confidence = Math.max(result.confidence, headerCheck.confidence);
            result.reasons.push(...headerCheck.reasons);
            result.details.headers = headerCheck.details;
        }

        // 3. 页面内容检测
        const contentCheck = await this._checkPageContent(page);
        if (contentCheck.blocked) {
            result.isBlocked = true;
            result.confidence = Math.max(result.confidence, contentCheck.confidence);
            result.reasons.push(...contentCheck.reasons);
            result.details.content = contentCheck.details;
        }

        // 4. DOM 结构检测 (验证码/安全检查元素)
        const domCheck = await this._checkDOMElements(page);
        if (domCheck.blocked) {
            result.isBlocked = true;
            result.confidence = Math.max(result.confidence, domCheck.confidence);
            result.reasons.push(...domCheck.reasons);
            result.details.dom = domCheck.details;
        }

        // 5. 重定向检测
        const redirectCheck = this._checkRedirect(page, response);
        if (redirectCheck.blocked) {
            result.isBlocked = true;
            result.confidence = Math.max(result.confidence, redirectCheck.confidence);
            result.reasons.push(...redirectCheck.reasons);
            result.details.redirect = redirectCheck.details;
        }

        // 保存调试信息
        if (this.saveDebugInfo) {
            await this._saveDebugInfo(page, siteName, result);
        }

        return result;
    }

    /**
     * 检查 HTTP 状态码
     * @private
     */
    _checkHttpStatus(response) {
        const status = response.status();
        const result = { blocked: false, confidence: 0, reasons: [], details: { code: status } };

        if (status === 403) {
            result.blocked = true;
            result.confidence = 0.9;
            result.reasons.push('HTTP 403 Forbidden - 访问被拒绝');
        } else if (status === 429) {
            result.blocked = true;
            result.confidence = 1.0;
            result.reasons.push('HTTP 429 Too Many Requests - 请求频率过高');
        } else if (status === 401) {
            result.blocked = true;
            result.confidence = 0.7;
            result.reasons.push('HTTP 401 Unauthorized - 需要身份验证');
        } else if (status >= 500) {
            result.blocked = true;
            result.confidence = 0.5;
            result.reasons.push(`HTTP ${status} Server Error - 服务器错误`);
        } else if (status === 302 || status === 301) {
            // 重定向不一定是拦截,需要检查目标URL
            result.confidence = 0.3;
            result.details.isRedirect = true;
        }

        return result;
    }

    /**
     * 检查 HTTP 响应头
     * @private
     */
    _checkHeaders(response) {
        const headers = response.headers();
        const result = { blocked: false, confidence: 0, reasons: [], details: {} };

        // 检查速率限制头
        if (headers['x-ratelimit-remaining'] === '0') {
            result.blocked = true;
            result.confidence = 0.95;
            result.reasons.push('Rate Limit 耗尽');
            result.details.rateLimit = headers['x-ratelimit-reset'];
        }

        // 检查 Cloudflare 特征
        if (headers['cf-ray'] && headers['cf-mitigated']) {
            result.blocked = true;
            result.confidence = 0.9;
            result.reasons.push('Cloudflare 缓解措施激活');
        }

        // 检查服务器类型
        if (headers['server']?.includes('CloudflareCAPTCHA')) {
            result.blocked = true;
            result.confidence = 1.0;
            result.reasons.push('Cloudflare CAPTCHA 检测');
        }

        return result;
    }

    /**
     * 检查页面文本内容
     * @private
     */
    async _checkPageContent(page) {
        const result = { blocked: false, confidence: 0, reasons: [], details: {} };

        try {
            // 获取页面文本内容
            const bodyText = await page.evaluate(() => document.body?.innerText || '');
            const textLength = bodyText.length;
            result.details.textLength = textLength;

            // 检查常见反爬提示文本
            const blockPatterns = [
                { pattern: /安全验证|安全检测|security\s*check/i, confidence: 0.9, label: '安全验证提示' },
                { pattern: /请完成验证|complete.*verification/i, confidence: 0.95, label: '验证请求' },
                { pattern: /访问被限制|access.*denied|访问拒绝/i, confidence: 0.85, label: '访问拒绝' },
                { pattern: /IP.*封禁|IP.*blocked/i, confidence: 0.95, label: 'IP 封禁' },
                { pattern: /访问频率.*过高|too\s*many\s*requests/i, confidence: 0.9, label: '频率限制' },
                { pattern: /robot|bot.*detected/i, confidence: 0.7, label: '机器人检测' },
                { pattern: /cloudflare/i, confidence: 0.6, label: 'Cloudflare 页面' }
            ];

            for (const { pattern, confidence, label } of blockPatterns) {
                if (pattern.test(bodyText)) {
                    result.blocked = true;
                    result.confidence = Math.max(result.confidence, confidence);
                    result.reasons.push(`检测到关键文本: ${label}`);
                }
            }

            // 检查内容是否过少 (可能是错误页面)
            if (textLength < 100) {
                result.confidence = Math.max(result.confidence, 0.6);
                result.reasons.push(`页面内容过少 (${textLength} 字符)`);
            }

        } catch (error) {
            result.details.error = error.message;
        }

        return result;
    }

    /**
     * 检查 DOM 元素 - 寻找验证码和安全检查组件
     * @private
     */
    async _checkDOMElements(page) {
        const result = { blocked: false, confidence: 0, reasons: [], details: {} };

        try {
            // 检查各种验证码元素
            const checkResults = await page.evaluate(() => {
                const checks = {
                    recaptcha: {
                        v2: !!document.querySelector('.g-recaptcha, iframe[src*="recaptcha"]'),
                        v3: !!document.querySelector('[data-sitekey]'),
                        badge: !!document.querySelector('.grecaptcha-badge')
                    },
                    hcaptcha: {
                        iframe: !!document.querySelector('iframe[src*="hcaptcha"]'),
                        element: !!document.querySelector('.h-captcha')
                    },
                    cloudflare: {
                        turnstile: !!document.querySelector('iframe[src*="turnstile"], [data-cf-turnstile-sitekey]'),
                        challenge: !!document.querySelector('#challenge-form, .cf-challenge'),
                        ray: !!document.querySelector('[data-ray]')
                    },
                    slider: {
                        geetest: !!document.querySelector('.geetest_holder, .geetest_popup'),
                        aliYun: !!document.querySelector('#nc_1_wrapper, .nc-container'),
                        tencentCaptcha: !!document.querySelector('#TCaptcha, .tcaptcha-transform')
                    },
                    generic: {
                        captchaImage: !!document.querySelector('img[src*="captcha"], img[alt*="验证码"]'),
                        verifyButton: !!document.querySelector('button[id*="verify"], button[class*="verify"]')
                    }
                };

                return checks;
            });

            result.details.elements = checkResults;

            // 根据检测结果设置置信度
            if (checkResults.recaptcha.v2 || checkResults.recaptcha.v3) {
                result.blocked = true;
                result.confidence = 0.95;
                result.reasons.push('检测到 reCAPTCHA');
            }

            if (checkResults.hcaptcha.iframe || checkResults.hcaptcha.element) {
                result.blocked = true;
                result.confidence = 0.95;
                result.reasons.push('检测到 hCaptcha');
            }

            if (checkResults.cloudflare.turnstile || checkResults.cloudflare.challenge) {
                result.blocked = true;
                result.confidence = 0.95;
                result.reasons.push('检测到 Cloudflare Turnstile/Challenge');
            }

            if (checkResults.slider.geetest || checkResults.slider.aliYun || checkResults.slider.tencentCaptcha) {
                result.blocked = true;
                result.confidence = 0.9;
                result.reasons.push('检测到滑块验证码');
            }

            if (checkResults.generic.captchaImage) {
                result.blocked = true;
                result.confidence = 0.85;
                result.reasons.push('检测到验证码图片');
            }

        } catch (error) {
            result.details.error = error.message;
        }

        return result;
    }

    /**
     * 检查重定向
     * @private
     */
    _checkRedirect(page, response) {
        const result = { blocked: false, confidence: 0, reasons: [], details: {} };

        const requestUrl = response.request().url();
        const finalUrl = page.url();

        result.details.requestUrl = requestUrl;
        result.details.finalUrl = finalUrl;

        if (requestUrl !== finalUrl) {
            result.details.wasRedirected = true;

            // 检查是否重定向到验证页面
            const suspiciousPatterns = [
                /verify|captcha|challenge|security|blocked|denied/i,
                /登录|login/i, // 可能被重定向到登录页
                /error|错误/i
            ];

            for (const pattern of suspiciousPatterns) {
                if (pattern.test(finalUrl)) {
                    result.blocked = true;
                    result.confidence = 0.8;
                    result.reasons.push(`重定向到可疑页面: ${finalUrl}`);
                    break;
                }
            }
        }

        return result;
    }

    /**
     * 保存调试信息
     * @private
     */
    async _saveDebugInfo(page, siteName, detectionResult) {
        const timestamp = Date.now();
        const debugDir = './debug';

        if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
        }

        try {
            // 保存截图
            await page.screenshot({
                path: `${debugDir}/${siteName}_${timestamp}.png`,
                fullPage: true
            });

            // 保存 HTML
            const html = await page.content();
            fs.writeFileSync(`${debugDir}/${siteName}_${timestamp}.html`, html);

            // 保存检测结果
            fs.writeFileSync(
                `${debugDir}/${siteName}_${timestamp}_result.json`,
                JSON.stringify(detectionResult, null, 2)
            );
        } catch (error) {
            console.error('保存调试信息失败:', error.message);
        }
    }

    /**
     * 格式化输出检测结果
     * @param {DetectionResult} result
     * @param {string} siteName
     */
    formatResult(result, siteName) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🔍 反爬检测结果: ${siteName}`);
        console.log(`${'='.repeat(60)}`);

        if (result.isBlocked) {
            console.log(`❌ 状态: 被拦截 (置信度: ${(result.confidence * 100).toFixed(1)}%)`);
            console.log(`\n📋 拦截原因:`);
            result.reasons.forEach((reason, i) => {
                console.log(`   ${i + 1}. ${reason}`);
            });
        } else {
            console.log(`✅ 状态: 正常访问`);
        }

        if (this.verbose && Object.keys(result.details).length > 0) {
            console.log(`\n📊 详细信息:`);
            console.log(JSON.stringify(result.details, null, 2));
        }
    }
}

module.exports = AntiScrapingDetector;
