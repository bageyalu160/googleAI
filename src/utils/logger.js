/**
 * Utility - Logger
 * 
 * Centralized logging utility with levels and formatting.
 * 
 * @module utils/logger
 */

const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

class Logger {
    constructor(options = {}) {
        this.level = options.level || (process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG);
        this.prefix = options.prefix || '';
        this.verbose = options.verbose !== false;
    }

    _log(level, levelName, emoji, ...args) {
        if (!this.verbose || level > this.level) {
            return;
        }

        const timestamp = new Date().toISOString();
        const prefix = this.prefix ? `[${this.prefix}]` : '';
        console.log(`${emoji} ${timestamp} ${prefix}`, ...args);
    }

    error(...args) {
        this._log(LOG_LEVELS.ERROR, 'ERROR', '❌', ...args);
    }

    warn(...args) {
        this._log(LOG_LEVELS.WARN, 'WARN', '⚠️ ', ...args);
    }

    info(...args) {
        this._log(LOG_LEVELS.INFO, 'INFO', 'ℹ️ ', ...args);
    }

    debug(...args) {
        this._log(LOG_LEVELS.DEBUG, 'DEBUG', '🐛', ...args);
    }

    success(...args) {
        this._log(LOG_LEVELS.INFO, 'SUCCESS', '✅', ...args);
    }
}

// Export singleton instance
const logger = new Logger();

module.exports = {
    Logger,
    logger,
    LOG_LEVELS
};
