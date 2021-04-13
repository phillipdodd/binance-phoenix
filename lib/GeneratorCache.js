class GeneratorCache {
    constructor() {
        this.generators = {};
    }

    addGeneratorForOrderID(generator, orderId) {
        this.generators[orderId] = generator;
    }

    getGeneratorForOrderID(orderId) {
        return this.generators[orderId];
    }

    updateGeneratorKey(oldKey, newKey) {
        if (this.generators[oldKey]) {
            this.generators[newKey] = this.generators[oldKey];
            delete this.generators[oldKey];
        }
    }
}

module.exports = GeneratorCache;