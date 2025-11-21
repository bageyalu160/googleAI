# 防机器人爬虫 (Anti-Bot Scraper)

具备 TLS 指纹伪造和反检测能力的专业网络爬虫框架。

## 🏗️ 架构

```
.
├── .github/
│   ├── workflows/          # GitHub Actions 工作流
│   │   ├── price-monitoring.yml
│   │   └── test-detection.yml
│   └── actions/            # 可复用的自定义 Actions
│       ├── setup-crawler/
│       └── upload-reports/
├── src/
│   ├── core/              # 核心模块
│   │   ├── browser-manager.js
│   │   ├── anti-scraping-detector.js
│   │   └── behavior-simulator.js
│   ├── scrapers/          # 爬虫实现
│   ├── utils/             # 工具函数
│   │   └── logger.js
│   └── config/            # 配置文件
│       ├── sites.js
│       └── products.js
├── tests/                 # 测试套件
├── scripts/               # 实用脚本
├── docs/                  # 文档
└── reports/               # 生成的报告
```

## 🚀 快速开始

### 本地开发

```bash
# 安装依赖
npm install

# 运行价格监控
node src/scrapers/price-monitor.js

# 开启调试模式运行
DEBUG=true node src/scrapers/price-monitor.js
```

### GitHub Actions

工作流触发方式：
- **自动触发**：每天 UTC 时间凌晨 2 点（北京时间上午 10 点）
- **推送触发**：当 `src/**` 目录发生变更时
- **手动触发**：通过 workflow_dispatch

## 📦 核心模块

### 浏览器管理器 (BrowserManager)
集中管理浏览器生命周期和配置，支持 TLS 指纹伪造。

```javascript
const BrowserManager = require('./src/core/browser-manager');

const browser = new BrowserManager({ headless: false });
await browser.init();
const page = browser.getPage();
```

### 反爬检测器 (Anti-Scraping Detector)
多维度的反机器人机制检测。

### 行为模拟器 (Behavior Simulator)
模拟人类交互行为。

## 🛠️ 配置

### 环境变量

```bash
# 必须
PROXY_URL=http://username:password@proxy:port

# 可选
NODE_ENV=production
DEBUG=false
```

### 网站配置

编辑 `src/config/sites.js` 以添加/修改目标网站。

### 商品配置

编辑 `src/config/products.js` 以管理监控的商品。

## 📊 工作流

### 价格监控 (Price Monitoring)
- **文件**: `.github/workflows/price-monitoring.yml`
- **用途**: 每日监控商品价格
- **矩阵**: 支持并行监控多个网站

### 检测测试 (Test Detection)
- **文件**: `.github/workflows/test-detection.yml`
- **用途**: 验证 TLS 指纹绕过的有效性

## 🧪 测试

```bash
# 运行单元测试
npm test

# 运行集成测试
npm run test:integration
```

## 📝 文档

- [架构设计](docs/architecture.md)
- [工作流指南](docs/workflows.md)
- [API 参考](docs/api.md)

## 🤝 贡献

1. 遵循既定的目录结构
2. 文件名使用 kebab-case（短横线命名）
3. 为所有函数编写 JSDoc 注释
4. 为新功能添加测试

## 📄 许可证

MIT
