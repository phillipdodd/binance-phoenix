const Calc = require('./Calc.js');

module.exports = class GeneratorFactory {

    constructor() {}

    static run(generator, price) {
        const result = generator.next(price).value;
        generator.next();
        return result;
    }

    static createIterator(price, percentage = 1.007) {
        const generator = function* () {
            const priceLimit = Calc.increaseByPercentage(price, percentage);
            const isInPriceRange = (price) => Calc.lessThanOrEqualTo(price, priceLimit);
            while (isInPriceRange(yield)) {
                yield true;
            }
        };
        const iterator = generator();
        iterator.next();
        return iterator;
    }

}