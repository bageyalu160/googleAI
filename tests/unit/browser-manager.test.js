/**
 * Unit Tests - Browser Manager
 * 
 * Tests for the BrowserManager core module.
 */

const BrowserManager = require('../../src/core/browser-manager');

describe('BrowserManager', () => {
    let browser;

    beforeEach(() => {
        browser = new BrowserManager({ headless: true });
    });

    afterEach(async () => {
        if (browser && browser.isInitialized()) {
            await browser.close();
        }
    });

    describe('Initialization', () => {
        test('should detect CI environment', () => {
            const isCI = process.env.CI === 'true';
            const manager = new BrowserManager();
            expect(manager.options.headless).toBe(isCI ? 'auto' : false);
        });

        test('should initialize browser', async () => {
            await browser.init();
            expect(browser.isInitialized()).toBe(true);
        });

        test('should throw if already initialized', async () => {
            await browser.init();
            await expect(browser.init()).rejects.toThrow('already initialized');
        });
    });

    describe('Navigation', () => {
        beforeEach(async () => {
            await browser.init();
        });

        test('should navigate to URL', async () => {
            const response = await browser.goto('https://example.com');
            expect(response).toBeDefined();
        });
    });

    describe('Cleanup', () => {
        test('should close browser', async () => {
            await browser.init();
            await browser.close();
            expect(browser.isInitialized()).toBe(false);
        });
    });
});
