const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, '../../reports/price/price-report.json');
const outputPath = path.join(__dirname, '../../reports/price/buying_guide.md');

try {
    const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    let md = '# 🛍️ 商品购买指南\n\n';
    md += `> 生成时间: ${new Date().toLocaleString()}\n\n`;

    for (const [category, catData] of Object.entries(data.categories)) {
        md += `## ${category.toUpperCase()}\n\n`;

        catData.products.forEach(p => {
            if (p.success && p.items.length > 0) {
                md += `### ${p.product}\n`;
                p.items.forEach(item => {
                    md += `#### ${item.title}\n`;
                    md += `- **价格**: ¥${item.price}\n`;
                    md += `- **商城**: ${item.mall || '未知'}\n`;
                    md += `- **链接**: [直达链接](${item.link})\n\n`;

                    md += `**📖 如何购买:**\n`;
                    if (item.howToBuy) {
                        // Quote the guide content
                        md += item.howToBuy.split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
                    } else {
                        md += `> 暂无详细指南\n\n`;
                    }
                    md += `---\n\n`;
                });
            }
        });
    }

    fs.writeFileSync(outputPath, md);
    console.log(`Report generated at: ${outputPath}`);

} catch (error) {
    console.error('Error generating report:', error);
    process.exit(1);
}
