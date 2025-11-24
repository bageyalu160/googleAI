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
const TencentSliderSolver = require('../utils/tencent-slider-solver');

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

        // 初始化滑块解决器
        this.sliderSolver = new TencentSliderSolver();
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

                        // Filter out article/post pages (usually don't have buying guides)
                        if (link.includes('post.smzdm.com')) {
                            return; // Skip article pages
                        }

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
                // 限制详情页抓取数量，避免触发腾讯防水墙
                const limitedItems = items.slice(0, 2); // 每个商品只抓前2个
                logger.info(`🔍 找到 ${items.length} 个商品，抓取前 ${limitedItems.length} 个详情页...`);

                for (const item of limitedItems) {
                    try {
                        // 1. Navigate to detail page - 独立捕获超时
                        try {
                            await page.goto(item.link, {
                                waitUntil: 'domcontentloaded',
                                timeout: 30000
                            });
                        } catch (gotoError) {
                            logger.warn(`   ⚠️  页面跳转失败: ${gotoError.message}`);
                            item.howToBuy = '页面跳转超时';
                            continue;
                        }

                        // 2. 模拟真实用户行为 - 失败不影响主流程
                        try {
                            await randomDelay(2000, 3000);
                            await page.evaluate(() => {
                                window.scrollTo(0, Math.random() * 300);
                            });

                            await randomDelay(2000, 4000);
                            await page.evaluate(() => {
                                window.scrollTo(0, document.body.scrollHeight * 0.4);
                            });
                        } catch (scrollError) {
                            // 滚动失败不影响主流程，仅记录
                            logger.debug(`   页面交互失败: ${scrollError.message}`);
                        }

                        // 增加延迟：8-15秒 (针对腾讯防水墙)
                        await randomDelay(8000, 15000);

                        // 3. Check for CAPTCHA/slider - 独立捕获
                        let hasCaptcha = false;
                        try {
                            hasCaptcha = await page.evaluate(() => {
                                const captchaKeywords = ['安全验证', '滑块', '拖动', 'captcha', 'slider'];
                                const bodyText = document.body?.innerText || '';
                                return captchaKeywords.some(keyword => bodyText.includes(keyword));
                            });
                        } catch (detectError) {
                            logger.debug(`   验证码检测失败: ${detectError.message}`);
                            // 检测失败假设无验证码，继续流程
                        }

                        // 4. 处理验证码 - 捕获解决器内部异常
                        if (hasCaptcha) {
                            logger.warn(`   ⚠️  检测到验证码，尝试自动解决...`);

                            try {
                                const solved = await this.sliderSolver.solve(page);

                                if (!solved) {
                                    logger.warn(`   ❌ 自动解决失败，跳过 "${item.title.substring(0, 15)}..."`);
                                    item.howToBuy = '需要人工验证，自动解决失败';
                                    continue;
                                }

                                logger.info(`   ✅ 滑块已自动解决，继续抓取...`);
                                await randomDelay(2000, 3000);
                            } catch (solverError) {
                                logger.error(`   ❌ 滑块解决器异常: ${solverError.message}`);
                                item.howToBuy = '滑块解决器错误';
                                continue;
                            }
                        }

                        // 5. Wait for main content to load
                        try {
                            await page.waitForSelector('.baoliao-block, article', { timeout: 5000 });
                        } catch (e) {
                            logger.warn(`   ⚠️  内容未加载，跳过 "${item.title.substring(0, 15)}..."`);
                            item.howToBuy = '页面加载失败';
                            continue;
                        }

                        // 6. Extract "How to Buy" content - 独立捕获
                        let howToBuy = '';
                        try {
                            howToBuy = await page.evaluate(() => {
                                const baoliaoBlocks = document.querySelectorAll('.baoliao-block');
                                let content = '';

                                baoliaoBlocks.forEach(block => {
                                    const text = block.innerText?.trim() || '';
                                    if (text) {
                                        content += text + '\n';
                                    }
                                });

                                return content.trim();
                            });
                        } catch (extractError) {
                            logger.debug(`   内容提取失败: ${extractError.message}`);
                            howToBuy = '';
                        }

                        item.howToBuy = howToBuy || '暂无购买指南';
                        logger.info(`   📄 已获取 "${item.title.substring(0, 15)}..." 的购买指南`);

                    } catch (error) {
                        // 最外层兜底捕获
                        logger.warn(`   ⚠️  无法获取 "${item.title.substring(0, 15)}..." 的详情: ${error.message}`);
                        item.howToBuy = '获取失败';
                    }
                }

                // 标记未抓取的商品
                for (let i = limitedItems.length; i < items.length; i++) {
                    items[i].howToBuy = '未抓取(限制数量)';
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
        let categoryIndex = 0;
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

            // 类别间休息 60-90 秒 (避免触发防水墙)
            categoryIndex++;
            if (categoryIndex < Object.keys(grouped).length) {
                logger.info(`\n⏸️  类别完成，休息 60-90 秒...\n`);
                await randomDelay(60000, 90000);
            }
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
