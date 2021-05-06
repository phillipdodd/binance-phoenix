const BaseLogger = require("./BaseLogger.js");
const logger = new BaseLogger("GeneratorCache").init();

class GeneratorCache {
    constructor() {
        this.generators = {};
    }

    addGeneratorForOrderID(generator, orderId) {
        try {
            this.generators[orderId] = generator;
            logger.info(`Adding new generator using orderId: ${orderId}`);
        } catch (err) {
           this.logger.error(`addGeneratorForOrderID: ${err.message}`);
           throw err;
        }
    }

    getGeneratorForOrderID(orderId) {
        try {
            return this.generators[orderId];
        } catch (err) {
           this.logger.error(`getGeneratorForOrderID: ${err.message}`);
           throw err;
        }
    }

    getTotalNumberOfGenerators() {
        try {
            return Object.keys(this.generators).length;
        } catch (err) {
            this.logger.error(`getTotalNumberOfGenerators: ${err.message}`);
            throw err;
        }
    }

    updateGeneratorKey(oldKey, newKey) {
        try {
            if (this.generators[oldKey]) {
                logger.info(`Moving generator: from ${oldKey} to ${newKey}`);
                this.generators[newKey] = this.generators[oldKey];
                delete this.generators[oldKey];
            }
        } catch (err) {
           this.logger.error(`updateGeneratorKey: ${err.message}`);
           throw err;
        }
    }
}

module.exports = GeneratorCache;
