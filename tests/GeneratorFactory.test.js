const GeneratorFactory = require('../lib/GeneratorFactory.js');
const Calc = require('../lib/Calc.js');

const price = 10, percentage = 1.007;

it('Can create generators', () => {
    const iterator = GeneratorFactory.createIterator(price, percentage);
    expect(iterator.next).toBeDefined();
});

describe('Price range', () => {
    const iterator = GeneratorFactory.createIterator(price, percentage);
    
    const priceLimit = Calc.mul(price, percentage);
    const underLimit = Calc.mul(priceLimit, 0.8);
    const overLimit = Calc.mul(priceLimit, 1.2);

    it('Proceeds if under limit', () => {
        const underResult = GeneratorFactory.run(iterator, underLimit);
        expect(underResult).toBe(true);
    });

    it('Stops if over limit', () => {
        const overResult = GeneratorFactory.run(iterator, overLimit);
        expect(overResult).toBe(undefined);
    });
});