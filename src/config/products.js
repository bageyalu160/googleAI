/**
 * Configuration - Products for Price Monitoring
 * 
 * Product configurations for price comparison and monitoring.
 * Organized by category with price ranges for validation.
 * 
 * @module config/products
 */

/**
 * Product configurations by category
 */
const PRODUCTS = {
    // Baby & Mother care products
    baby: [
        {
            name: '爱他美奶粉',
            keywords: ['爱他美'],
            priceRange: [50, 1000],
            category: 'baby'
        },
        {
            name: '花王尿不湿',
            keywords: ['花王', '尿不湿', '纸尿裤'],
            priceRange: [50, 300],
            category: 'baby'
        },
        {
            name: '帮宝适纸尿裤',
            keywords: ['帮宝适', '纸尿裤'],
            priceRange: [50, 300],
            category: 'baby'
        }
    ],

    // Household products
    household: [
        {
            name: '维达抽纸',
            keywords: ['维达', '抽纸'],
            priceRange: [10, 100],
            category: 'household'
        },
        {
            name: '心相印卷纸',
            keywords: ['心相印', '卷纸'],
            priceRange: [10, 100],
            category: 'household'
        },
        {
            name: '保鲜袋',
            keywords: ['保鲜袋'],
            priceRange: [5, 50],
            category: 'household'
        },
        {
            name: '保鲜膜',
            keywords: ['保鲜膜'],
            priceRange: [5, 50],
            category: 'household'
        },
        {
            name: '立白洗衣液',
            keywords: ['立白', '洗衣液'],
            priceRange: [10, 100],
            category: 'household'
        },
        {
            name: '洗洁精',
            keywords: ['洗洁精'],
            priceRange: [5, 50],
            category: 'household'
        }
    ]
};

/**
 * Get all products as flat array
 * @returns {Array} Array of all products
 */
function getAllProducts() {
    const products = [];
    Object.values(PRODUCTS).forEach(category => {
        products.push(...category);
    });
    return products;
}

/**
 * Get products by category
  * @param {string} category - Category name ('baby' or 'household')
 * @returns {Array} Array of products in category
 */
function getProductsByCategory(category) {
    return PRODUCTS[category] || [];
}

/**
 * Find product by name
 * @param {string} name - Product name
 * @returns {Object|null} Product configuration or null
 */
function findProductByName(name) {
    const allProducts = getAllProducts();
    return allProducts.find(product => product.name === name);
}

module.exports = {
    PRODUCTS,
    getAllProducts,
    getProductsByCategory,
    findProductByName
};
