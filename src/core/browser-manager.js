/**
 * Browser Manager
 * 
 * Manages browser lifecycle, configuration, and TLS fingerprint spoofing.
 * Provides a centralized interface for browser operations.
 * 
 * @module core/browser-manager
 */

const { connect } = require('puppeteer-real-browser');

/**
 * Browser Manager Class
 * Handles browser initialization, configuration, and lifecycle
 */
class BrowserManager {
    /**
     * @param {Object} options - Configuration options
     * @param {boolean} options.headless - Run in headless mode
     * @param {Array<string>} options.args - Additional browser arguments
     * @param {string} options.proxyUrl - Proxy server URL
     * @param {boolean} options.fingerprint - Enable TLS fingerprint spoofing
     * @param {boolean} options.turnstile - Enable Cloudflare Turnstile bypass
     */
    constructor(options = {}) {
        this.options = {
            headless: options.headless ?? this._detectEnvironment(),
            args: options.args || this._getDefaultArgs(),
            proxyUrl: options.proxyUrl || process.env.PROXY_URL,
            fingerprint: options.fingerprint ?? true,
            turnstile: options.turnstile ?? true,
            ...options
        };

        this.browser = null;
        this.page = null;
    }

    /**
     * Detect if running in CI environment
     * @private
     */
    _detectEnvironment() {
        const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
        return isCI ? 'auto' : false;
    }

    /**
     * Get default browser arguments
     * @private
     */
    _getDefaultArgs() {
        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1920,1080',
            '--lang=zh-CN,zh',
            '--disable-blink-features=AutomationControlled'
        ];

        if (this.options.proxyUrl) {
            args.push(`--proxy-server=${this.options.proxyUrl}`);
        }

        return args;
    }

    /**
     * Initialize browser instance
     * @returns {Promise<Object>} Browser and page objects
     */
    async init() {
        if (this.browser) {
            throw new Error('Browser already initialized');
        }

        const { page, browser } = await connect({
            headless: this.options.headless,
            args: this.options.args,
            turnstile: this.options.turnstile,
            fingerprint: this.options.fingerprint,
            customConfig: this.options.customConfig || {}
        });

        this.browser = browser;
        this.page = page;

        // Set default viewport
        await this.page.setViewport({
            width: 1920,
            height: 1080
        });

        // Set default headers
        await this.page.setExtraHTTPHeaders({
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        });

        return { browser, page };
    }

    /**
     * Get current page instance
     * @returns {Page} Puppeteer page
     */
    getPage() {
        if (!this.page) {
            throw new Error('Browser not initialized. Call init() first.');
        }
        return this.page;
    }

    /**
     * Get current browser instance
     * @returns {Browser} Puppeteer browser
     */
    getBrowser() {
        if (!this.browser) {
            throw new Error('Browser not initialized. Call init() first.');
        }
        return this.browser;
    }

    /**
     * Navigate to URL
     * @param {string} url - Target URL
     * @param {Object} options - Navigation options
     */
    async goto(url, options = {}) {
        const page = this.getPage();
        return await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
            ...options
        });
    }

    /**
     * Take screenshot
     * @param {string} path - Screenshot file path
     * @param {Object} options - Screenshot options
     */
    async screenshot(path, options = {}) {
        const page = this.getPage();
        return await page.screenshot({
            path,
            fullPage: false,
            ...options
        });
    }

    /**
     * Close browser
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    /**
     * Check if browser is initialized
     * @returns {boolean}
     */
    isInitialized() {
        return this.browser !== null && this.page !== null;
    }
}

module.exports = BrowserManager;
