const Calc = require('../lib/Calc.js');
const BaseLogger = require("../lib/BaseLogger.js");
const logger = new BaseLogger("GeneratorFactory").init();
module.exports = class GeneratorFactory {

    constructor() {}

    static run(generator, price) {
        try {
            const result = generator.next(price).value;
            generator.next();
            return result;
        } catch (err) {
           this.logger.error(`run: ${err.message}`);
           throw err;
        }
    }

    static createIterator(price, percentage = 1.007) {
        try {
            const generator = function* () {
                const priceLimit = Calc.increaseByPercentage(price, percentage);
                logger.info(`createIterator: price is ${price}`);
                logger.info(`createIterator: priceLimit is ${priceLimit}`);
                const isInPriceRange = (price) => Calc.lessThanOrEqualTo(price, priceLimit);
                while (isInPriceRange(yield)) {
                    yield true;
                }
            };
            const iterator = generator();
            iterator.next();
            return iterator;
        } catch (err) {
           this.logger.error(`createIterator: ${err.message}`);
           throw err;
        }
    }

}