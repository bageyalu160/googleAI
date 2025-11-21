/**
 * Configuration - Target Websites
 * 
 * Centralized configuration for all target websites.
 * Organized by category for easy management.
 * 
 * @module config/sites
 */

/**
 * Website categories and their configurations
 */
const SITES = {
    // E-commerce platforms
    ecommerce: {
        jd: {
            name: '京东',
            url: 'https://www.jd.com',
            category: 'ecommerce'
        },
        taobao: {
            name: '淘宝',
            url: 'https://www.taobao.com',
            category: 'ecommerce'
        },
        tmall: {
            name: '天猫',
            url: 'https://www.tmall.com',
            category: 'ecommerce'
        },
        pdd: {
            name: '拼多多',
            url: 'https://www.pinduoduo.com',
            category: 'ecommerce'
        },
        vip: {
            name: '唯品会',
            url: 'https://www.vip.com',
            category: 'ecommerce'
        }
    },

    // Price comparison sites
    priceComparison: {
        smzdm: {
            name: '什么值得买',
            url: 'https://www.smzdm.com',
            searchUrl: 'https://search.smzdm.com/?c=home&s=',
            category: 'price_comparison'
        },
        manmanbuy: {
            name: '慢慢买',
            url: 'https://www.manmanbuy.com',
            searchUrl: 'https://tool.manmanbuy.com/search.aspx?w=',
            category: 'price_comparison'
        }
    },

    // Search engines
    search: {
        baidu: {
            name: '百度',
            url: 'https://www.baidu.com',
            category: 'search'
        },
        sogou: {
            name: '搜狗',
            url: 'https://www.sogou.com',
            category: 'search'
        }
    },

    // Test sites for anti-scraping detection
    testSites: {
        stytch: {
            name: 'Stytch',
            url: 'https://nobots.dev',
            category: 'test'
        },
        sannysoft: {
            name: 'Sannysoft',
            url: 'https://bot.sannysoft.com',
            category: 'test'
        }
    }
};

/**
 * Get all sites as flat array
 * @returns {Array} Array of all site configurations
 */
function getAllSites() {
    const sites = [];
    Object.values(SITES).forEach(category => {
        Object.values(category).forEach(site => {
            sites.push(site);
        });
    });
    return sites;
}

/**
 * Get sites by category
 * @param {string} category - Category name
 * @returns {Array} Array of sites in category
 */
function getSitesByCategory(category) {
    return Object.values(SITES[category] || {});
}

/**
 * Find site by name
 * @param {string} name - Site name
 * @returns {Object|null} Site configuration or null
 */
function findSiteByName(name) {
    const all Sites = getAllSites();
    return allSites.find(site => site.name === name);
}

module.exports = {
    SITES,
    getAllSites,
    getSitesByCategory,
    findSiteByName
};
