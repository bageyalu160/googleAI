/**
 * Base Scraper Class
 * 
 * Abstract base class for all scrapers.
 * Provides common functionality and enforces consistent interface.
 * 
 * @module scrapers/base-scraper
 */

const BrowserManager = require('../core/browser-manager');
const { logger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * Base Scraper Class
 * All scrapers should extend this class
 */
class BaseScraper {
    /**
     * @param {Object} options - Scraper configuration
     * @param {string} options.name - Scraper name
     * @param {boolean} options.verbose - Enable verbose logging
     * @param {string} options.reportsDir - Reports output directory
     */
    constructor(options = {}) {
        this.name = options.name || 'BaseScraper';
        this.verbose = options.verbose !== false;
        this.reportsDir = options.reportsDir || path.join(process.cwd(), 'reports');

        this.browser = new BrowserManager({
            headless: options.headless,
            proxyUrl: options.proxyUrl
        });

        this.results = {};
        this.startTime = null;
        this.endTime = null;
    }

    /**
     * Initialize scraper
     * Override if needed
     */
    async init() {
        this.startTime = Date.now();
        logger.info(`[${this.name}] Initializing...`);
        await this.browser.init();
        logger.success(`[${this.name}] Browser initialized`);
    }

    /**
     * Main scraping logic
     * MUST be implemented by subclasses
     */
    async scrape() {
        throw new Error('scrape() must be implemented by subclass');
    }

    /**
     * Save results to file
     * @param {string} filename - Output filename
     * @param {Object} data - Data to save
     */
    async save(filename, data) {
        // Ensure reports directory exists
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }

        const filepath = path.join(this.reportsDir, filename);

        if (filename.endsWith('.json')) {
            fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        } else {
            fs.writeFileSync(filepath, data);
        }

        logger.info(`[${this.name}] Saved: ${filepath}`);
        return filepath;
    }

    /**
     * Take screenshot
     * @param {string} name - Screenshot name
     */
    async screenshot(name) {
        const filename = `${this.name}_${name}_${Date.now()}.png`;
        const filepath = path.join(this.reportsDir, filename);
        await this.browser.screenshot(filepath);
        logger.info(`[${this.name}] Screenshot: ${filepath}`);
        return filepath;
    }

    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.browser.isInitialized()) {
            await this.browser.close();
            logger.info(`[${this.name}] Browser closed`);
        }

        this.endTime = Date.now();
        const duration = ((this.endTime - this.startTime) / 1000).toFixed(2);
        logger.success(`[${this.name}] Completed in ${duration}s`);
    }

    /**
     * Run the complete scraping workflow
     */
    async run() {
        try {
            await this.init();
            const results = await this.scrape();
            this.results = results;
            return results;
        } catch (error) {
            logger.error(`[${this.name}] Error:`, error.message);
            throw error;
        } finally {
            await this.cleanup();
        }
    }

    /**
     * Get execution duration
     * @returns {number} Duration in seconds
     */
    getDuration() {
        if (!this.endTime || !this.startTime) {
            return 0;
        }
        return (this.endTime - this.startTime) / 1000;
    }
}

module.exports = BaseScraper;
