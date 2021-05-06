const GeneratorCache = require('../lib/GeneratorCache.js');
const GeneratorFactory = require('../lib/GeneratorFactory.js');

const orderIdA = '12345';
const orderIdB = '54321';

const generatorCache = new GeneratorCache();

it('Can add new generator', () => {
    const newGenerator = GeneratorFactory.createIterator(1);
    generatorCache.addGeneratorForOrderID(newGenerator, orderIdA);
    // console.dir( instanceof Function);
    expect(generatorCache.getGeneratorForOrderID(orderIdA)).toBeDefined();
    expect(generatorCache.getGeneratorForOrderID(orderIdA).next instanceof Function).toBe(true);
});

describe('Can update generator key', () => {
    it('Does not currently have a generator for orderIdB', () => {
        expect(generatorCache.getGeneratorForOrderID(orderIdB)).toBeUndefined();
    });
    it('Can update generator key', () => {
        generatorCache.updateGeneratorKey(orderIdA, orderIdB);
        expect(generatorCache.getGeneratorForOrderID(orderIdB)).toBeDefined();
        expect(generatorCache.getGeneratorForOrderID(orderIdB).next instanceof Function).toBe(true);
    });
    it('Removes previous generator key', () => {
        expect(generatorCache.getGeneratorForOrderID(orderIdA)).toBeUndefined();
    });
});

it('Can get total number of generators', () => {
    expect(generatorCache.getTotalNumberOfGenerators()).toBe(1);
});