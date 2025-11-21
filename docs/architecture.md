# 系统架构

## 概述

Anti-Bot Scraper 是一个专业的网络爬虫框架，旨在绕过现代反爬虫检测机制，同时保持代码质量并遵循 GitHub Actions 最佳实践。

## 设计原则

1.  **模块化**：每个组件具有单一职责
2.  **可复用性**：核心模块可在不同的爬虫之间复用
3.  **配置优于代码**：使用外部配置以提高灵活性
4.  **CI/CD 优先**：设计为在 GitHub Actions 中无缝运行

## 系统架构

```
┌─────────────────────────────────────────────────┐
│           GitHub Actions 工作流                  │
│  (price-monitoring.yml, test-detection.yml)     │
└──────────────────┬──────────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │    自定义 Actions   │
         │  - setup-crawler   │
         │  - upload-reports  │
         └─────────┬─────────┘
                   │
    ┌──────────────▼───────────────┐
    │          爬虫层               │
    │  ┌─────────────────────────┐ │
    │  │   price-monitor.js      │ │
    │  │   (继承 BaseScraper)     │ │
    │  └───────────┬─────────────┘ │
    └──────────────┼───────────────┘
                   │
    ┌──────────────▼───────────────┐
    │          核心层               │
    │  ┌───────────────────────┐   │
    │  │  BrowserManager       │   │
    │  │  - TLS 指纹伪造        │   │
    │  │  - 代理支持            │   │
    │  └───────────────────────┘   │
    │  ┌───────────────────────┐   │
    │  │  AntiScrapingDetector │   │
    │  │  - 多维度检测          │   │
    │  └───────────────────────┘   │
    │  ┌───────────────────────┐   │
    │  │  BehaviorSimulator    │   │
    │  │  - 人类行为模拟        │   │
    │  └───────────────────────┘   │
    └──────────────────────────────┘
                   │
    ┌──────────────▼───────────────┐
    │          配置层               │
    │  - sites.js  (网站配置)       │
    │  - products.js (商品配置)     │
    └───────────────────────────────┘
```

## 组件职责

### 核心层 (Core Layer)

**BrowserManager (浏览器管理器)**
- 浏览器生命周期管理
- 环境检测 (CI vs 本地)
- TLS 指纹伪造配置
- 代理设置和管理

**AntiScrapingDetector (反爬检测器)**
- HTTP 状态码分析
- 响应头检查
- DOM 元素检测 (验证码等)
- 内容分析
- 重定向检测

**BehaviorSimulator (行为模拟器)**
- 随机延迟
- 鼠标移动模拟
- 滚动模拟
- 人类交互模拟

### 爬虫层 (Scrapers Layer)

**BaseScraper** (抽象基类)
- 通用爬虫接口
- 初始化/清理生命周期
- 结果保存
- 截图捕获
- 错误处理

**PriceMonitor** (具体实现)
- 商品价格监控
- 多站点支持
- 基于类别的过滤
- 报告生成

### 配置层 (Configuration Layer)

**sites.js**
- 网站 URL 和元数据
- 类别组织
- 搜索 URL 模板

**products.js**
- 商品定义
- 价格范围验证
- 关键词管理
- 类别分组

## 数据流

```
1. 工作流触发 (GitHub Actions)
          ↓
2. 自定义 Action: setup-crawler
   - 安装依赖
   - 设置环境
          ↓
3. 爬虫初始化
   - 加载配置
   - 创建 BrowserManager
          ↓
4. 浏览器启动
   - TLS 指纹伪造
   - 代理配置
   - 环境适配
          ↓
5. 爬取过程
   - 导航到目标
   - 行为模拟
   - 数据提取
   - 反爬检测
          ↓
6. 结果处理
   - 数据验证
   - 报告生成
   - 截图捕获
          ↓
7. 自定义 Action: upload-reports
   - 上传构件 (Artifacts)
   - 设置保留策略
          ↓
8. 工作流摘要
   - 生成 Markdown 摘要
   - 在 GitHub UI 中显示
```

## 扩展点

### 添加新爬虫

1. 继承 `BaseScraper`
2. 实现 `scrape()` 方法
3. 使用核心模块 (BrowserManager 等)
4. 使用继承的方法保存结果

```javascript
class MyScraper extends BaseScraper {
  async scrape() {
    const page = this.browser.getPage();
    // 你的逻辑代码
  }
}
```

### 添加新网站

1. 编辑 `src/config/sites.js`
2. 添加网站配置
3. 在爬虫中引用

```javascript
SITES.myCategory.newSite = {
  name: '新网站',
  url: 'https://example.com',
  category: 'myCategory'
};
```

### 添加新工作流

1. 创建 `.github/workflows/my-workflow.yml`
2. 使用自定义 actions 保持一致性
3. 遵循命名规范
4. 添加详细注释

## 安全考量

1.  **密钥管理**：使用 GitHub Secrets 存储敏感数据
2.  **代理 URL**：切勿提交代理凭据
3.  **速率限制**：尊重目标网站的资源
4.  **权限**：最小化 GITHUB_TOKEN 权限

## 性能优化

1.  **依赖缓存**：通过自定义 actions 自动处理
2.  **矩阵策略**：并行执行任务
3.  **并发控制**：防止冗余运行
4.  **构件保留**：平衡的保留策略

## 测试策略

1.  **单元测试**：核心模块 (BrowserManager 等)
2.  **集成测试**：完整的爬虫工作流
3.  **CI 测试**：推送/PR 时自动运行
4.  **手动测试**：通过 workflow_dispatch 进行临时运行
