/**
 * Tencent Captcha Slider Auto-Solver
 * 自动识别并解决腾讯防水墙滑块验证码
 */

const logger = require('./logger');

class TencentSliderSolver {
    constructor() {
        this.sliderSelectors = [
            '#tcaptcha_drag_thumb',
            '.tc-drag-thumb',
            '[class*="drag-thumb"]',
            '[class*="slider-button"]'
        ];

        this.trackSelectors = [
            '.tc-drag-track',
            '[class*="drag-track"]',
            '[class*="slider-track"]'
        ];
    }

    /**
     * 检测是否有腾讯滑块
     */
    async detectSlider(page) {
        return await page.evaluate((selectors) => {
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) return true;
            }
            return false;
        }, this.sliderSelectors);
    }

    /**
     * 生成人类滑动轨迹
     * @param {number} distance - 滑动距离（像素）
     * @returns {Array} 轨迹点数组
     */
    generateHumanTrack(distance) {
        const tracks = [];
        let current = 0;
        let t = 0;
        const totalTime = 0.8 + Math.random() * 0.6; // 0.8-1.4秒

        while (current < distance) {
            const progress = t / totalTime;

            // 加速-匀速-减速曲线
            let a;
            if (progress < 0.25) {
                a = 8; // 加速阶段
            } else if (progress < 0.75) {
                a = 0; // 匀速阶段
            } else {
                a = -6; // 减速阶段
            }

            const v0 = tracks.length > 0 ? tracks[tracks.length - 1].v : 0;
            const dt = 0.02; // 20ms间隔
            const v = Math.max(0, v0 + a * dt);
            const s = v0 * dt + 0.5 * a * dt * dt;

            current += s;
            t += dt;

            // 添加随机抖动
            const jitter = (Math.random() - 0.5) * 0.5;

            tracks.push({
                x: Math.min(Math.round(current + jitter), distance),
                v: v,
                t: Math.round(t * 1000)
            });

            if (current >= distance) break;
        }

        // 确保最后一个点精确到达目标
        tracks.push({
            x: distance,
            v: 0,
            t: Math.round(totalTime * 1000)
        });

        return tracks;
    }

    /**
     * 尝试解决滑块
     */
    async solve(page) {
        try {
            logger.info('   🤖 检测到滑块，尝试自动解决...');

            // 1. 查找滑块元素
            const slider = await this.findSliderElement(page);
            if (!slider) {
                logger.warn('   ⚠️  未找到滑块元素');
                return false;
            }

            // 2. 获取滑块位置和滑动距离
            const sliderBox = await slider.boundingBox();
            if (!sliderBox) {
                logger.warn('   ⚠️  无法获取滑块位置');
                return false;
            }

            // 3. 估算滑动距离（腾讯滑块通常需要滑动到缺口位置）
            // 由于我们无法看到缺口，使用一个经验值：滑动轨道宽度的60-80%
            const trackWidth = await page.evaluate(() => {
                const track = document.querySelector('.tc-drag-track, [class*="drag-track"]');
                return track ? track.offsetWidth : 300;
            });

            const distance = Math.floor(trackWidth * (0.65 + Math.random() * 0.15));
            logger.info(`   📏 估算滑动距离: ${distance}px`);

            // 4. 生成人类轨迹
            const tracks = this.generateHumanTrack(distance);
            logger.info(`   🎯 生成 ${tracks.length} 个轨迹点`);

            // 5. 执行滑动
            await this.performDrag(page, slider, sliderBox, tracks);

            // 6. 等待验证结果
            await page.waitForTimeout(2000);

            // 7. 检查是否通过
            const isPassed = await this.checkIfPassed(page);

            if (isPassed) {
                logger.info('   ✅ 滑块验证通过！');
                return true;
            } else {
                logger.warn('   ❌ 滑块验证失败');
                return false;
            }

        } catch (error) {
            logger.error(`   ❌ 自动解决滑块失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 查找滑块元素
     */
    async findSliderElement(page) {
        for (const selector of this.sliderSelectors) {
            try {
                const element = await page.$(selector);
                if (element) return element;
            } catch (e) {
                continue;
            }
        }
        return null;
    }

    /**
     * 执行拖动
     */
    async performDrag(page, slider, sliderBox, tracks) {
        const startX = sliderBox.x + sliderBox.width / 2;
        const startY = sliderBox.y + sliderBox.height / 2;

        // 移动到滑块中心
        await page.mouse.move(startX, startY);
        await page.waitForTimeout(100 + Math.random() * 100);

        // 按下鼠标
        await page.mouse.down();
        await page.waitForTimeout(50 + Math.random() * 50);

        // 按照轨迹移动
        let lastTime = 0;
        for (const track of tracks) {
            const delay = track.t - lastTime;
            if (delay > 0) {
                await page.waitForTimeout(delay);
            }

            await page.mouse.move(startX + track.x, startY + (Math.random() - 0.5) * 2);
            lastTime = track.t;
        }

        // 释放鼠标
        await page.waitForTimeout(50 + Math.random() * 100);
        await page.mouse.up();
    }

    /**
     * 检查是否通过验证
     */
    async checkIfPassed(page) {
        return await page.evaluate(() => {
            // 检查滑块是否消失
            const slider = document.querySelector('#tcaptcha_iframe, .tc-captcha');
            if (!slider) return true;

            // 检查是否有成功提示
            const success = document.querySelector('.tc-jpp-success, [class*="success"]');
            if (success) return true;

            // 检查是否有错误提示
            const error = document.querySelector('.tc-jpp-error, [class*="error"]');
            if (error) return false;

            return false;
        });
    }
}

module.exports = TencentSliderSolver;
