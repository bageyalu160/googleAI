/**
 * 什么值得买 - 优化版价格爬虫
 * 支持母婴和日用品价格查询
 * 兼容本地和GitHub Actions环境
 */
const { connect } = require('puppeteer-real-browser');
const { randomDelay } = require('./behavior_utils');
const fs = require('fs');

// 商品配置
const PRODUCT_CONFIG = {
    母婴: [
        { name: '爱他美奶粉', keywords: ['爱他美', '奶粉'], priceRange: [100, 500] },
        { name: '花王尿不湿', keywords: ['花王', '尿不湿', '纸尿裤'], priceRange: [50, 300] },
        { name: '帮宝适', keywords: ['帮宝适', '纸尿裤'], priceRange: [50, 300] }
    ],
    日用品: [
        { name: '维达抽纸', keywords: ['维达', '抽纸'], priceRange: [10, 100] },
        { name: '心相印卷纸', keywords: ['心相印', '卷纸'], priceRange: [10, 100] },
        { name: '保鲜袋', keywords: ['保鲜袋'], priceRange: [5, 50] },
        { name: '立白洗衣液', keywords: ['立白', '洗衣液'], priceRange: [10, 100] },
        { name: '洗洁精', keywords: ['洗洁精'], priceRange: [5, 50] }
    ]
};

class ZDMCrawler {
    constructor(options = {}) {
        this.isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
        this.verbose = options.verbose !== false;
        this.results = {};
    }

    log(message) {
        if (this.verbose) {
            console.log(message);
        }
    }

    async searchProduct(page, productConfig) {
        const keyword = productConfig.keywords[0];
        this.log(`\n${'='.repeat(60)}`);
        this.log(`🔍 搜索: ${productConfig.name}`);
        this.log(`${'='.repeat(60)}`);

        try {
            const searchUrl = `https://search.smzdm.com/?c=home&s=${encodeURIComponent(keyword)}`;
            this.log(`📍 ${searchUrl}`);

            await page.goto(searchUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 20000
            });

            await randomDelay(3000, 5000);

            // 提取商品信息
            const items = await page.evaluate((config) => {
                const results = [];

                // 查找商品卡片
                const cards = document.querySelectorAll('li.feed-row-wide, .z-feed-card, article');

                cards.forEach((card, index) => {
                    if (index >= 6) return;

                    try {
                        const cardHTML = card.innerHTML;
                        const cardText = card.innerText;

                        // 检查是否包含关键词
                        const hasKeyword = config.keywords.some(kw =>
                            cardText.toLowerCase().includes(kw.toLowerCase())
                        );

                        if (!hasKeyword) return;

                        // 提取标题
                        const titleEl = card.querySelector('h5, .feed-block-title, .z-feed-title');
                        const title = titleEl ? titleEl.textContent.trim() : '';

                        // 从卡片HTML中提取价格 - 更精确的方法
                        // 价格通常在特定的class中,如 "z-highlight" 或包含 "¥" 符号
                        const priceElements = card.querySelectorAll('span, em, strong');
                        let currentPrice = null;

                        for (const el of priceElements) {
                            const text = el.textContent.trim();
                            // 匹配 ¥数字 或 数字元 格式
                            const match = text.match(/¥?\s*(\d+(?:\.\d{1,2})?)\s*元?/);
                            if (match) {
                                const price = parseFloat(match[1]);
                                // 检查是否在合理价格范围内
                                if (price >= config.priceRange[0] && price <= config.priceRange[1]) {
                                    currentPrice = price;
                                    break;
                                }
                            }
                        }

                        // 如果没找到,尝试从cardText中提取
                        if (!currentPrice) {
                            const matches = cardText.match(/¥\s*(\d+(?:\.\d{1,2})?)/g);
                            if (matches) {
                                for (const m of matches) {
                                    const price = parseFloat(m.replace(/[¥\s]/g, ''));
                                    if (price >= config.priceRange[0] && price <= config.priceRange[1]) {
                                        currentPrice = price;
                                        break;
                                    }
                                }
                            }
                        }

                        // 提取链接
                        const linkEl = card.querySelector('a[href]');
                        const link = linkEl ? linkEl.href : '';

                        // 提取商城信息
                        const mallEl = card.querySelector('.feed-block-extras, .z-feed-foot');
                        const mallText = mallEl ? mallEl.textContent : '';
                        const mall = mallText.match(/(京东|天猫|淘宝|拼多多|苏宁)/)?.[1] || '';

                        if (title && currentPrice) {
                            results.push({
                                title: title.substring(0, 100),
                                price: currentPrice,
                                mall,
                                link: link.substring(0, 150)
                            });
                        }
                    } catch (e) {
                        // 跳过错误项
                    }
                });

                return results;
            }, {
                keywords: productConfig.keywords,
                priceRange: productConfig.priceRange
            });

            // 输出结果
            if (items.length > 0) {
                this.log(`\n✅ 找到 ${items.length} 个商品:\n`);
                items.forEach((item, i) => {
                    this.log(`${i + 1}. ${item.title}`);
                    this.log(`   💰 ¥${item.price.toFixed(2)}`);
                    if (item.mall) this.log(`   🏪 ${item.mall}`);
                    this.log('');
                });

                return {
                    success: true,
                    product: productConfig.name,
                    count: items.length,
                    items,
                    avgPrice: items.reduce((sum, item) => sum + item.price, 0) / items.length,
                    minPrice: Math.min(...items.map(i => i.price)),
                    maxPrice: Math.max(...items.map(i => i.price))
                };
            } else {
                this.log(`\n⚠️  未找到符合条件的商品`);
                return {
                    success: false,
                    product: productConfig.name,
                    count: 0
                };
            }

        } catch (error) {
            this.log(`\n❌ 错误: ${error.message}`);
            return {
                success: false,
                product: productConfig.name,
                error: error.message
            };
        }
    }

    async run() {
        this.log('🚀 什么值得买价格爬虫 - 优化版\n');
        this.log(`📱 环境: ${this.isCI ? 'GitHub Actions' : '本地'}\n`);

        // 启动浏览器
        const { page, browser } = await connect({
            headless: this.isCI ? 'auto' : false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--window-size=1920,1080',
                '--lang=zh-CN,zh'
            ],
            turnstile: true,
            fingerprint: true
        });

        await page.setViewport({ width: 1920, height: 1080 });

        // 测试母婴类
        this.log('='.repeat(60));
        this.log('👶 母婴类商品');
        this.log('='.repeat(60));

        this.results.母婴 = [];
        for (const product of PRODUCT_CONFIG.母婴) {
            const result = await this.searchProduct(page, product);
            this.results.母婴.push(result);
            await randomDelay(3000, 5000);
        }

        // 测试日用品类
        this.log('\n' + '='.repeat(60));
        this.log('🏠 日用品类商品');
        this.log('='.repeat(60));

        this.results.日用品 = [];
        for (const product of PRODUCT_CONFIG.日用品) {
            const result = await this.searchProduct(page, product);
            this.results.日用品.push(result);
            await randomDelay(3000, 5000);
        }

        // 截图
        await page.screenshot({
            path: 'zdm_final_screenshot.png',
            fullPage: true
        });
        this.log('\n📸 截图已保存: zdm_final_screenshot.png');

        await browser.close();

        // 生成报告
        this.generateReport();
    }

    generateReport() {
        this.log('\n' + '='.repeat(60));
        this.log('📊 查询报告');
        this.log('='.repeat(60) + '\n');

        const summary = {
            timestamp: new Date().toISOString(),
            environment: this.isCI ? 'CI' : 'Local',
            categories: {}
        };

        let totalSuccess = 0;
        let totalProducts = 0;

        Object.entries(this.results).forEach(([category, results]) => {
            this.log(`${category === '母婴' ? '👶' : '🏠'} ${category}:`);

            const categoryData = {
                products: []
            };

            results.forEach(r => {
                totalProducts++;
                if (r.success) {
                    totalSuccess++;
                    this.log(`   ✅ ${r.product}: ${r.count}个优惠, 均价 ¥${r.avgPrice.toFixed(2)}, 最低 ¥${r.minPrice.toFixed(2)}`);
                    categoryData.products.push(r);
                } else {
                    this.log(`   ❌ ${r.product}: 未找到`);
                    categoryData.products.push(r);
                }
            });

            summary.categories[category] = categoryData;
            this.log('');
        });

        summary.successRate = `${totalSuccess}/${totalProducts} (${(totalSuccess / totalProducts * 100).toFixed(1)}%)`;

        this.log(`成功率: ${summary.successRate}\n`);

        // 保存JSON
        fs.writeFileSync('zdm_price_report.json', JSON.stringify(summary, null, 2));
        this.log('💾 详细报告: zdm_price_report.json');

        // 保存可读性报告
        this.saveReadableReport(summary);
    }

    saveReadableReport(summary) {
        let report = '# 什么值得买价格查询报告\n\n';
        report += `**查询时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
        report += `**环境**: ${summary.environment}\n`;
        report += `**成功率**: ${summary.successRate}\n\n`;

        Object.entries(summary.categories).forEach(([category, data]) => {
            report += `## ${category === '母婴' ? '👶' : '🏠'} ${category}\n\n`;

            data.products.forEach(p => {
                if (p.success) {
                    report += `### ✅ ${p.product}\n`;
                    report += `- 找到 ${p.count} 个优惠\n`;
                    report += `- 平均价格: ¥${p.avgPrice.toFixed(2)}\n`;
                    report += `- 价格区间: ¥${p.minPrice.toFixed(2)} - ¥${p.maxPrice.toFixed(2)}\n\n`;

                    if (p.items && p.items.length > 0) {
                        report += '**商品列表**:\n\n';
                        p.items.forEach((item, i) => {
                            report += `${i + 1}. ${item.title.substring(0, 60)}...\n`;
                            report += `   - 价格: ¥${item.price.toFixed(2)}\n`;
                            if (item.mall) report += `   - 商城: ${item.mall}\n`;
                            report += '\n';
                        });
                    }
                } else {
                    report += `### ❌ ${p.product}\n`;
                    report += `未找到相关商品\n\n`;
                }
            });
        });

        fs.writeFileSync('zdm_price_report.md', report);
        this.log('📄 可读性报告: zdm_price_report.md\n');
    }
}

// 运行爬虫
(async () => {
    const crawler = new ZDMCrawler({ verbose: true });
    await crawler.run();
    console.log('✅ 完成!');
})();
