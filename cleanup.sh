#!/bin/bash

# 项目清理脚本
# 清理测试过程中生成的临时文件和过时的测试脚本

echo "🧹 开始清理项目..."

# 1. 删除测试截图和临时HTML文件
echo ""
echo "📸 清理测试截图和HTML文件..."
rm -f jd_*.png
rm -f taobao_*.png  
rm -f zdm_*.png
rm -f manmanbuy_*.png
rm -f 京东_*.png
rm -f 淘宝_*.png
rm -f 唯品会_*.png
rm -f 微博_*.png
rm -f 新浪_*.png
rm -f 智联招聘_*.png
rm -f 汽车之家_*.png
rm -f 腾讯网_*.png
rm -f CSDN_*.png
rm -f *_detailed.png
rm -f *_detailed.html
rm -f *_professional_test.png
rm -f *_test.png
rm -f sannysoft_*.png
rm -f stytch_*.png

echo "   ✅ 已删除测试截图"

# 2. 删除临时JSON报告(保留最终版)
echo ""
echo "📄 清理临时JSON报告..."
rm -f jd_price_report.json
rm -f taobao_price_report.json
rm -f manmanbuy_results.json
# 保留 zdm_price_report.json (最终版)

echo "   ✅ 已删除临时报告"

# 3. 删除调试目录(如果存在)
if [ -d "debug" ]; then
    echo ""
    echo "🗑️  删除调试目录..."
    rm -rf debug
    echo "   ✅ 已删除debug目录"
fi

# 4. 移动过时的测试脚本到archive目录
echo ""
echo "📦 归档过时的测试脚本..."
mkdir -p archive

# 过时的测试脚本
mv -f src/ecommerce_test.js archive/ 2>/dev/null
mv -f src/ecommerce_analysis.js archive/ 2>/dev/null  
mv -f src/ecommerce_test_v2.js archive/ 2>/dev/null
mv -f src/jd_price_crawler.js archive/ 2>/dev/null
mv -f src/taobao_price_crawler.js archive/ 2>/dev/null
mv -f src/phone_price_simple.js archive/ 2>/dev/null
mv -f src/jd_category_prices.js archive/ 2>/dev/null
mv -f src/manmanbuy_crawler.js archive/ 2>/dev/null
mv -f src/zdm_price_crawler.js archive/ 2>/dev/null

echo "   ✅ 已归档过时脚本到 archive/"

echo ""
echo "✅ 清理完成!"
echo ""
echo "📋 保留的核心文件:"
echo "   - src/main.js (主爬虫)"
echo "   - src/stytch_bypass.js (Stytch绕过)"
echo "   - src/china_top50_test.js (前50网站测试)"
echo "   - src/blocked_sites_test.js (被拦截网站测试)"
echo "   - src/zdm_crawler_optimized.js (什么值得买爬虫-最终版)"
echo "   - src/anti_scraping_detector.js (反爬检测模块)"
echo "   - src/behavior_utils.js (行为模拟工具)"
echo ""
echo "📁 归档的文件在: archive/"
echo "💾 最终报告: zdm_price_report.json, zdm_price_report.md"
