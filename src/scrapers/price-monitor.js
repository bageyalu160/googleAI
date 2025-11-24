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
        logger.info(`🔍 正在搜索: ${product.name}`);

        try {
            const siteConfig = SITES.priceComparison[this.site];
            if (!siteConfig) {
                throw new Error(`站点 ${this.site} 未配置`);
            }

            const searchUrl = siteConfig.searchUrl + encodeURIComponent(keyword);
            await this.browser.goto(searchUrl);
            await randomDelay(3000, 5000);

            const page = this.browser.getPage();

            // Extract product information
            // Extract product information
            let items = await page.evaluate((config) => {
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
                        const title = titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : '';

                        // Extract price with specific selectors
                        let currentPrice = null;

                        // Priority 1: Large price number (e.g. detail page style or prominent card style)
                        const priceLargeNum = card.querySelector('.price-large .num');
                        if (priceLargeNum) {
                            currentPrice = parseFloat(priceLargeNum.textContent.trim());
                        }

                        // Priority 2: Z-highlight class
                        if (!currentPrice) {
                            const highlightPrice = card.querySelector('.z-highlight');
                            if (highlightPrice) {
                                const match = highlightPrice.textContent.trim().match(/(\d+(?:\.\d{1,2})?)/);
                                if (match) currentPrice = parseFloat(match[1]);
                            }
                        }

                        // Priority 3: Fallback to generic search if still null
                        if (!currentPrice) {
                            const priceElements = card.querySelectorAll('span, em, strong');
                            for (const el of priceElements) {
                                const text = el.textContent.trim();
                                const match = text.match(/¥?\s*(\d+(?:\.\d{1,2})?)\s*元?/);
                                if (match) {
                                    const price = parseFloat(match[1]);
                                    // Basic sanity check: price shouldn't be part of a date or count usually
                                    if (price > 0) {
                                        currentPrice = price;
                                        break;
                                    }
                                }
                            }
                        }

                        // Validate price range
                        if (currentPrice !== null) {
                            if (currentPrice < config.priceRange[0] || currentPrice > config.priceRange[1]) {
                                currentPrice = null; // Discard if out of range
                            }
                        }

                        const linkEl = card.querySelector('a[href]');
                        const link = linkEl ? linkEl.href : '';

                        const mallEl = card.querySelector('.feed-block-extras, .z-feed-foot');
                        const mallText = mallEl ? mallEl.textContent : '';
                        const mall = mallText.match(/(京东|天猫|淘宝|拼多多)/)?.[1] || '';

                        if (title && currentPrice && link) {
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

            // Scrape detail pages for "How to Buy" guide
            if (items.length > 0) {
                logger.info(`🔍 找到 ${items.length} 个商品，正在抓取详情页...`);

                for (const item of items) {
                    try {
                        // Navigate to detail page
                        await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
                        await randomDelay(1000, 2000);

                        // Extract "How to Buy" content
                        const howToBuy = await page.evaluate(() => {
                            const baoliaoBlocks = document.querySelectorAll('.baoliao-block');
                            let content = '';

                            baoliaoBlocks.forEach(block => {
                                // Check for "小编补充" or just take the text
                                const text = block.innerText.trim();
                                if (text) {
                                    content += text + '\n';
                                }
                            });

                            return content.trim();
                        });

                        item.howToBuy = howToBuy || '暂无购买指南';
                        logger.info(`   📄 已获取 "${item.title.substring(0, 15)}..." 的购买指南`);

                    } catch (error) {
                        logger.warn(`   ⚠️ 无法获取 "${item.title.substring(0, 15)}..." 的详情: ${error.message}`);
                        item.howToBuy = '获取失败';
                    }
                }
            }

            if (items.length > 0) {
                logger.success(`✅ ${product.name}: 找到 ${items.length} 个商品`);

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
                logger.warn(`⚠️  ${product.name}: 未找到商品`);
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
        logger.info(`🎯 分类: ${this.category}`);
        logger.info(`🛒 站点: ${this.site}\n`);

        // Get products to monitor
        const products = this.category === 'all'
            ? getAllProducts()
            : getProductsByCategory(this.category);

        logger.info(`📦 正在监控 ${products.length} 个商品\n`);

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
        logger.success(`成功率: ${this.summary.successRate}`);
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
        category: 'all',
        reportsDir: 'reports/price'
    };

    args.forEach(arg => {
        const [key, value] = arg.replace(/^--/, '').split('=');
        options[key] = value;
    });

    const monitor = new PriceMonitor(options);
    monitor.run()
        .then(() => {
            logger.success('✅ 价格监控完成');
            process.exit(0);
        })
        .catch(error => {
            logger.error('❌ 致命错误:', error);
            process.exit(1);
        });
}

module.exports = PriceMonitor;
