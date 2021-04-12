const DataHandler = require('./DataHandler.js');
const Calc = require('./Calc.js');
const fs = require('fs');

class InstanceUtility {
    constructor(instance) {
        this.instance = instance;
    }

    async cancelAllOpenBuyOrders() {
        let orders = await this.instance.client.openOrders();
        orders
            .filter((order) => order.side === "BUY")
            .forEach((order) => {
                this.instance.client.cancelOrder({
                    symbol: order.symbol,
                    orderId: order.orderId,
                });
            });
    }

    //todo misnomer?
    correctTickAndStep(options) {
        //* Market orders will not be including a 'price' property
        if (options.hasOwnProperty("price")) {
            options.price = Calc.roundToTickSize(options.price, this.exchangeInfo[options.symbol].tickSize);
        }

        if (options.hasOwnProperty("quantity")) {
            options.quantity = Calc.roundToStepSize(options.quantity, this.exchangeInfo[options.symbol].stepSize);
        }

        return options;
    }

    async updateExchangeInfo() {
        try {
            let exchangeInfo = await this.getSimplifiedExchangeInfo();
            //TODO if this is cached in this way, do i even need to write it to a file in the first place?
            this.exchangeInfo = exchangeInfo;
            await this.writeExchangeInfoToFile(exchangeInfo);
            this.instance.logger.info("exchangeInfo.json up to date.");
        } catch (e) {
            this.instance.logger.error(`updateExchangeInfo: ${e.message}`);
        }
    }

    async getSimplifiedExchangeInfo() {
        try {
            let exchangeInfo = await this.instance.client.exchangeInfo();

            let simplifiedExchangeInfo = {};
            exchangeInfo.symbols.forEach((value) => {
                simplifiedExchangeInfo[value.symbol] = simplifyExchangeInfo(value);
            });

            return simplifiedExchangeInfo;
        } catch (e) {
            this.instance.logger.error(`getExchangeInfo: ${e.message}`);
        }
    }

    async writeExchangeInfoToFile(exchangeInfo) {
        fs.writeFileSync(`./exchangeInfo.json`, JSON.stringify(exchangeInfo));
    }

    async getBestBidPrice(symbol) {
        const orderBook = await this.instance.client.book({ symbol: symbol });
        return orderBook.bids[0].price;
    }

    async getBuyQuantity(eventData) {
        const pairType = this.getPairType(eventData.symbol);
        const startingValue = this.strategy[`starting${pairType}`];

        const bestBidPrice = await this.getBestBidPrice(eventData.symbol);
        const buyQuantity = Calc.divBy(startingValue, bestBidPrice);
        return buyQuantity;
    }

    getSellPrice(eventData) {
        let tickSize = exchangeInfo[eventData.symbol].tickSize;
        let increaseAmount = Calc.mul(tickSize, this.strategy.numTickIncrease);
        let buyPrice = eventData.orderType === "MARKET" ? eventData.priceLastTrade : eventData.price;
        let sellPrice = Calc.add(increaseAmount, buyPrice);
        return sellPrice;
    }

    getPairType(symbol) {
        let isFiat = symbol.slice(symbol.length - 4, symbol.length - 1) === "USD";
        let sliceLength = isFiat ? 4 : 3;
        return symbol.slice(symbol.length - sliceLength, symbol.length);
    }
};

function getFilterValue(value, filterName) {
    return value.filters.find((filter) => {
        return filter.hasOwnProperty(filterName);
    })[filterName];
}

function simplifyExchangeInfo(value) {
    return {
        baseAsset: value.baseAsset,
        quoteAsset: value.quoteAsset,
        quotePrecision: value.quotePrecision,
        status: value.status,
        tickSize: getFilterValue(value, "tickSize"),
        stepSize: getFilterValue(value, "stepSize"),
        minNotional: getFilterValue(value, "minNotional"),
    };
}

module.exports = InstanceUtility;