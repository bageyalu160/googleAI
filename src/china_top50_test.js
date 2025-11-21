/**
 * 中国前50知名网站反爬测试
 * 测试 TLS 指纹绕过方案的有效性
 */
const { connect } = require('puppeteer-real-browser');
const { randomDelay } = require('./behavior_utils');
const AntiScrapingDetector = require('./anti_scraping_detector');
const fs = require('fs');

// 中国前50知名网站列表
const TOP50_SITES = [
    // 搜索引擎
    { name: '百度', url: 'https://www.baidu.com', category: '搜索' },
    { name: '搜狗', url: 'https://www.sogou.com', category: '搜索' },
    { name: '360搜索', url: 'https://www.so.com', category: '搜索' },

    // 电商
    { name: '淘宝', url: 'https://www.taobao.com', category: '电商' },
    { name: '京东', url: 'https://www.jd.com', category: '电商' },
    { name: '天猫', url: 'https://www.tmall.com', category: '电商' },
    { name: '拼多多', url: 'https://www.pinduoduo.com', category: '电商' },
    { name: '苏宁易购', url: 'https://www.suning.com', category: '电商' },
    { name: '唯品会', url: 'https://www.vip.com', category: '电商' },
    { name: '当当', url: 'https://www.dangdang.com', category: '电商' },

    // 视频
    { name: '爱奇艺', url: 'https://www.iqiyi.com', category: '视频' },
    { name: '腾讯视频', url: 'https://v.qq.com', category: '视频' },
    { name: '优酷', url: 'https://www.youku.com', category: '视频' },
    { name: '哔哩哔哩', url: 'https://www.bilibili.com', category: '视频' },
    { name: '抖音', url: 'https://www.douyin.com', category: '视频' },

    // 社交媒体
    { name: '微博', url: 'https://www.weibo.com', category: '社交' },
    { name: '知乎', url: 'https://www.zhihu.com', category: '社交' },
    { name: '小红书', url: 'https://www.xiaohongshu.com', category: '社交' },
    { name: 'QQ空间', url: 'https://qzone.qq.com', category: '社交' },

    // 新闻门户
    { name: '新浪', url: 'https://www.sina.com.cn', category: '新闻' },
    { name: '网易', url: 'https://www.163.com', category: '新闻' },
    { name: '搜狐', url: 'https://www.sohu.com', category: '新闻' },
    { name: '腾讯网', url: 'https://www.qq.com', category: '新闻' },
    { name: '今日头条', url: 'https://www.toutiao.com', category: '新闻' },

    // 金融
    { name: '支付宝', url: 'https://www.alipay.com', category: '金融' },
    { name: '东方财富', url: 'https://www.eastmoney.com', category: '金融' },
    { name: '同花顺', url: 'https://www.10jqka.com.cn', category: '金融' },

    // 生活服务
    { name: '美团', url: 'https://www.meituan.com', category: '生活' },
    { name: '大众点评', url: 'https://www.dianping.com', category: '生活' },
    { name: '饿了么', url: 'https://www.ele.me', category: '生活' },
    { name: '58同城', url: 'https://www.58.com', category: '生活' },
    { name: '赶集网', url: 'https://www.ganji.com', category: '生活' },

    // 旅游出行
    { name: '携程', url: 'https://www.ctrip.com', category: '旅游' },
    { name: '去哪儿', url: 'https://www.qunar.com', category: '旅游' },
    { name: '马蜂窝', url: 'https://www.mafengwo.cn', category: '旅游' },
    { name: '滴滴出行', url: 'https://www.didiglobal.com', category: '出行' },

    // 游戏
    { name: '4399', url: 'https://www.4399.com', category: '游戏' },
    { name: '7k7k', url: 'https://www.7k7k.com', category: '游戏' },
    { name: '17173', url: 'https://www.17173.com', category: '游戏' },

    // 招聘
    { name: '智联招聘', url: 'https://www.zhaopin.com', category: '招聘' },
    { name: '前程无忧', url: 'https://www.51job.com', category: '招聘' },
    { name: 'Boss直聘', url: 'https://www.zhipin.com', category: '招聘' },

    // 房产
    { name: '链家', url: 'https://www.lianjia.com', category: '房产' },
    { name: '安居客', url: 'https://www.anjuke.com', category: '房产' },

    // 汽车
    { name: '汽车之家', url: 'https://www.autohome.com.cn', category: '汽车' },
    { name: '易车', url: 'https://www.yiche.com', category: '汽车' },

    // 其他
    { name: '豆瓣', url: 'https://www.douban.com', category: '社区' },
    { name: '虎扑', url: 'https://www.hupu.com', category: '社区' },
    { name: 'CSDN', url: 'https://www.csdn.net', category: '技术' },
];

class Top50Tester {
    constructor(options = {}) {
        this.detector = new AntiScrapingDetector({
            verbose: false,
            saveDebugInfo: false
        });
        this.timeout = options.timeout || 15000;
        this.delayBetween = options.delayBetween || [2000, 4000];
        this.results = [];
    }

    async testSite(page, site) {
        const startTime = Date.now();
        console.log(`\n🔍 [${this.results.length + 1}/${TOP50_SITES.length}] 测试: ${site.name} (${site.category})`);

        try {
            let mainResponse = null;
            const responses = [];

            // 监听所有响应
            const responseHandler = (r) => {
                responses.push(r);
            };
            page.on('response', responseHandler);

            await page.goto(site.url, {
                waitUntil: 'domcontentloaded',
                timeout: this.timeout
            });

            // 移除监听器
            page.off('response', responseHandler);

            await randomDelay(500, 1000);

            // 选择主文档响应
            const hostname = new URL(site.url).hostname;
            mainResponse = responses.find(r =>
                r.url() === site.url ||
                (r.url().includes(hostname) && r.request().resourceType() === 'document')
            ) || responses[0];

            const result = {
                name: site.name,
                category: site.category,
                url: site.url,
                finalUrl: page.url(),
                duration: Date.now() - startTime,
                detection: null,
                status: 'unknown'
            };

            if (mainResponse) {
                result.httpStatus = mainResponse.status();
                result.detection = await this.detector.detect(page, mainResponse, site.name);
                result.status = result.detection.isBlocked ? 'blocked' : 'passed';

                const emoji = result.status === 'passed' ? '✅' : '❌';
                const confidence = result.detection.confidence > 0 ?
                    ` (${(result.detection.confidence * 100).toFixed(0)}%)` : '';
                console.log(`   ${emoji} 状态: ${result.status === 'passed' ? '通过' : '拦截'}${confidence}`);

                if (result.detection.reasons.length > 0) {
                    console.log(`   原因: ${result.detection.reasons[0]}`);
                }
            } else {
                result.status = 'no_response';
                console.log(`   ⚠️  未能获取响应`);
            }

            return result;

        } catch (error) {
            console.log(`   ❌ 错误: ${error.message}`);
            return {
                name: site.name,
                category: site.category,
                url: site.url,
                status: 'error',
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }

    async runTests(maxSites = null) {
        console.log('🚀 开始中国前50知名网站反爬测试\n');
        console.log(`📊 测试网站数量: ${maxSites || TOP50_SITES.length}`);
        console.log(`⏱️  超时设置: ${this.timeout}ms`);
        console.log(`⏳ 间隔时间: ${this.delayBetween[0]}-${this.delayBetween[1]}ms\n`);

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
            console.log('🔒 使用代理:', process.env.PROXY_URL.replace(/:[^:]+@/, ':****@\n'));
            launchArgs.args.push(`--proxy-server=${process.env.PROXY_URL}`);
        }

        const { page, browser } = await connect(launchArgs);
        await page.setViewport({ width: 1280, height: 960 });
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        });

        const sitesToTest = maxSites ? TOP50_SITES.slice(0, maxSites) : TOP50_SITES;

        for (const site of sitesToTest) {
            const result = await this.testSite(page, site);
            this.results.push(result);

            // 延迟避免频率过高
            if (this.results.length < sitesToTest.length) {
                await randomDelay(...this.delayBetween);
            }
        }

        await browser.close();

        // 生成报告
        this.generateReport();
    }

    generateReport() {
        console.log(`\n${'='.repeat(70)}`);
        console.log('📊 测试报告');
        console.log(`${'='.repeat(70)}\n`);

        const stats = {
            total: this.results.length,
            passed: this.results.filter(r => r.status === 'passed').length,
            blocked: this.results.filter(r => r.status === 'blocked').length,
            error: this.results.filter(r => r.status === 'error').length,
            noResponse: this.results.filter(r => r.status === 'no_response').length
        };

        console.log('📈 总体统计:');
        console.log(`   总测试数: ${stats.total}`);
        console.log(`   ✅ 通过: ${stats.passed} (${(stats.passed / stats.total * 100).toFixed(1)}%)`);
        console.log(`   ❌ 拦截: ${stats.blocked} (${(stats.blocked / stats.total * 100).toFixed(1)}%)`);
        console.log(`   ⚠️  错误: ${stats.error} (${(stats.error / stats.total * 100).toFixed(1)}%)`);
        console.log(`   ⚠️  无响应: ${stats.noResponse} (${(stats.noResponse / stats.total * 100).toFixed(1)}%)`);

        // 按分类统计
        console.log('\n📂 分类统计:');
        const categories = {};
        this.results.forEach(r => {
            if (!categories[r.category]) {
                categories[r.category] = { total: 0, passed: 0, blocked: 0 };
            }
            categories[r.category].total++;
            if (r.status === 'passed') categories[r.category].passed++;
            if (r.status === 'blocked') categories[r.category].blocked++;
        });

        Object.entries(categories).forEach(([cat, stats]) => {
            const passRate = (stats.passed / stats.total * 100).toFixed(0);
            console.log(`   ${cat.padEnd(8)}: ${stats.passed}/${stats.total} 通过 (${passRate}%)`);
        });

        // 被拦截的网站
        const blocked = this.results.filter(r => r.status === 'blocked');
        if (blocked.length > 0) {
            console.log('\n❌ 被拦截的网站:');
            blocked.forEach(r => {
                const reason = r.detection?.reasons[0] || '未知';
                console.log(`   - ${r.name}: ${reason}`);
            });
        }

        // 保存详细报告
        const reportPath = 'china_top50_report.json';
        fs.writeFileSync(reportPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            stats,
            categories,
            results: this.results
        }, null, 2));

        console.log(`\n💾 详细报告已保存: ${reportPath}`);
        console.log('\n✅ 测试完成!');
    }
}

// 运行测试
(async () => {
    const tester = new Top50Tester({
        timeout: 15000,
        delayBetween: [2000, 4000]
    });

    // 可以限制测试数量,例如只测试前10个
    const maxSites = process.argv[2] ? parseInt(process.argv[2]) : null;

    await tester.runTests(maxSites);
})();
