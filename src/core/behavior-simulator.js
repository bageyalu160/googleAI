/**
 * 行为模拟工具 - 模拟人类行为以绕过机器人检测
 */

/**
 * 随机延迟,模拟人类思考时间
 * @param {number} min - 最小延迟(毫秒)
 * @param {number} max - 最大延迟(毫秒)
 */
async function randomDelay(min = 500, max = 2000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 模拟人类鼠标移动轨迹
 * @param {Page} page - Puppeteer 页面对象
 * @param {number} moves - 移动次数
 */
async function humanMouseMove(page, moves = 3) {
    for (let i = 0; i < moves; i++) {
        const x = Math.floor(Math.random() * 800) + 100;
        const y = Math.floor(Math.random() * 600) + 100;

        await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 20) });
        await randomDelay(200, 800);
    }
}

/**
 * 随机滚动页面
 * @param {Page} page - Puppeteer 页面对象
 */
async function randomScroll(page) {
    await page.evaluate(() => {
        const scrollAmount = Math.floor(Math.random() * 300) + 100;
        window.scrollBy({
            top: scrollAmount,
            behavior: 'smooth'
        });
    });
    await randomDelay(500, 1500);
}

/**
 * 综合人类化等待 - 包含随机延迟、鼠标移动和滚动
 * @param {Page} page - Puppeteer 页面对象
 */
async function waitForHuman(page) {
    await randomDelay(1000, 2500);
    await humanMouseMove(page, 2);

    // 50% 概率进行滚动
    if (Math.random() > 0.5) {
        await randomScroll(page);
    }

    await randomDelay(500, 1500);
}

module.exports = {
    randomDelay,
    humanMouseMove,
    randomScroll,
    waitForHuman
};
