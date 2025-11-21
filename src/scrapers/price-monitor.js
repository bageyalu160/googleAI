/**
 * Price Monitor Scraper
 * 
 * Monitors product prices from price comparison websites.
 * Based on the optimized ZDM crawler, now using new architecture.
 * 
 * @module scrapers/price-monitor
 */

const BaseScraper = require('./base-scraper');
const { getProductsByCategory, getAllProducts } = require('../config/products');
const { SITES } = require('../config/sites');
const { randomDelay } = require('../core/behavior-simulator');
const { logger } = require('../utils/logger');

/**
 * Price Monitor Scraper Class
 */
class PriceMonitor extends BaseScraper {
    constructor(options = {}) {
        super({
            name: 'PriceMonitor',
            ...options
        });

        this.site = options.site || 'smzdm';
        this.category = options.category || 'all';
        this.summary = {
            timestamp: new Date().toISOString(),
            site: this.site,
            category: this.category,
            categories: {}
        };
    }

    /**
     * Search for a product on the site
     * @param {Object} product - Product configuration
     */
    async searchProduct(product) {
        const keyword = product.keywords[0];
        logger.info(`🔍 Searching: ${product.name}`);

        try {
            const siteConfig = SITES.priceComparison[this.site];
            if (!siteConfig) {
                throw new Error(`Site ${this.site} not configured`);
            }

            const searchUrl = siteConfig.searchUrl + encodeURIComponent(keyword);
            await this.browser.goto(searchUrl);
            await randomDelay(3000, 5000);

            const page = this.browser.getPage();

            // Extract product information
            const items = await page.evaluate((config) => {
                const results = [];
                const cards = document.querySelectorAll('li.feed-row-wide, .z-feed-card, article');

                cards.forEach((card, index) => {
                    if (index >= 6) return;

                    try {
                        const cardText = card.innerText;
                        const hasKeyword = config.keywords.some(kw =>
                            cardText.toLowerCase().includes(kw.toLowerCase())
                        );

                        if (!hasKeyword) return;

                        const titleEl = card.querySelector('h5, .feed-block-title, .z-feed-title');
                        const title = titleEl ? titleEl.textContent.trim() : '';

                        // Extract price with range validation
                        const priceElements = card.querySelectorAll('span, em, strong');
                        let currentPrice = null;

                        for (const el of priceElements) {
                            const text = el.textContent.trim();
                            const match = text.match(/¥?\s*(\d+(?:\.\d{1,2})?)\s*元?/);
                            if (match) {
                                const price = parseFloat(match[1]);
                                if (price >= config.priceRange[0] && price <= config.priceRange[1]) {
                                    currentPrice = price;
                                    break;
                                }
                            }
                        }

                        const linkEl = card.querySelector('a[href]');
                        const link = linkEl ? linkEl.href : '';

                        const mallEl = card.querySelector('.feed-block-extras, .z-feed-foot');
                        const mallText = mallEl ? mallEl.textContent : '';
                        const mall = mallText.match(/(京东|天猫|淘宝|拼多多)/)?.[1] || '';

                        if (title && currentPrice) {
                            results.push({
                                title: title.substring(0, 100),
                                price: currentPrice,
                                mall,
                                link: link.substring(0, 150)
                            });
                        }
                    } catch (e) {
                        // Skip
                    }
                });

                return results;
            }, {
                keywords: product.keywords,
                priceRange: product.priceRange
            });

            if (items.length > 0) {
                logger.success(`✅ ${product.name}: Found ${items.length} items`);

                const avgPrice = items.reduce((sum, item) => sum + item.price, 0) / items.length;
                const minPrice = Math.min(...items.map(i => i.price));
                const maxPrice = Math.max(...items.map(i => i.price));

                return {
                    success: true,
                    product: product.name,
                    count: items.length,
                    items,
                    avgPrice,
                    minPrice,
                    maxPrice
                };
            } else {
                logger.warn(`⚠️  ${product.name}: No items found`);
                return {
                    success: false,
                    product: product.name,
                    count: 0
                };
            }

        } catch (error) {
            logger.error(`❌ ${product.name}: ${error.message}`);
            return {
                success: false,
                product: product.name,
                error: error.message
            };
        }
    }

    /**
     * Main scraping logic
     */
    async scrape() {
        logger.info(`🎯 Category: ${this.category}`);
        logger.info(`🛒 Site: ${this.site}\n`);

        // Get products to monitor
        const products = this.category === 'all'
            ? getAllProducts()
            : getProductsByCategory(this.category);

        logger.info(`📦 Monitoring ${products.length} products\n`);

        // Group by category
        const grouped = {};
        products.forEach(p => {
            if (!grouped[p.category]) {
                grouped[p.category] = [];
            }
            grouped[p.category].push(p);
        });

        // Process each category
        for (const [category, categoryProducts] of Object.entries(grouped)) {
            logger.info(`${'='.repeat(60)}`);
            logger.info(`${category === 'baby' ? '👶' : '🏠'} ${category.toUpperCase()}`);
            logger.info(`${'='.repeat(60)}\n`);

            const results = [];
            for (const product of categoryProducts) {
                const result = await this.searchProduct(product);
                results.push(result);
                await randomDelay(3000, 5000);
            }

            this.summary.categories[category] = { products: results };
        }

        // Calculate success rate
        const totalProducts = products.length;
        const successCount = Object.values(this.summary.categories)
            .flatMap(c => c.products)
            .filter(p => p.success).length;

        this.summary.successRate = `${successCount}/${totalProducts} (${(successCount / totalProducts * 100).toFixed(1)}%)`;

        logger.info(`\n${'='.repeat(60)}`);
        logger.success(`Success Rate: ${this.summary.successRate}`);
        logger.info(`${'='.repeat(60)}\n`);

        // Save reports
        await this.save('price-report.json', this.summary);
        await this.screenshot('final');

        return this.summary;
    }
}

// CLI execution
if (require.main === module) {
    const args = process.argv.slice(2);
    const options = {
        site: 'smzdm',
        category: 'all'
    };

    args.forEach(arg => {
        const [key, value] = arg.replace(/^--/, '').split('=');
        options[key] = value;
    });

    const monitor = new PriceMonitor(options);
    monitor.run()
        .then(() => {
            logger.success('✅ Price monitoring completed');
            process.exit(0);
        })
        .catch(error => {
            logger.error('❌ Fatal error:', error);
            process.exit(1);
        });
}

module.exports = PriceMonitor;
