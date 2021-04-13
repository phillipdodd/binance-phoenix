const Calc = require('./Calc.js');
const fs = require('fs');

class InstanceUtility {
    constructor(instance) {
        this.instance = instance;
    }

    async cancelAllOpenBuyOrders() {
        try {
            let orders = await this.instance.client.openOrders();
            orders
                .filter((order) => order.side === "BUY")
                .forEach((order) => {
                    this.instance.client.cancelOrder({
                        symbol: order.symbol,
                        orderId: order.orderId,
                    });
                });
        } catch (err) {
           this.instance.logger.error(`cancelAllOpenOrders: ${err.message}`);
           throw err;
        }
    }

    //todo misnomer?
    correctTickAndStep(options) {
        try {
            //* Market orders will not be including a 'price' property
            if (options.hasOwnProperty("price")) {
                options.price = Calc.roundToTickSize(options.price, this.exchangeInfo[options.symbol].tickSize);
            }

            if (options.hasOwnProperty("quantity")) {
                options.quantity = Calc.roundToStepSize(options.quantity, this.exchangeInfo[options.symbol].stepSize);
            }

            return options;
        } catch (err) {
           this.instance.logger.error(`correctTickAndStep: ${err.message}`);
           throw err;
        }
    }

    async updateExchangeInfo() {
        try {
            let exchangeInfo = await this.getSimplifiedExchangeInfo();
            //TODO if this is cached in this way, do i even need to write it to a file in the first place?
            this.exchangeInfo = exchangeInfo;
            await this.writeExchangeInfoToFile(exchangeInfo);
            this.instance.logger.info("exchangeInfo.json up to date.");
        } catch (err) {
            this.instance.logger.error(`updateExchangeInfo: ${err.message}`);
            throw err;
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
        } catch (err) {
            this.instance.logger.error(`getExchangeInfo: ${err.message}`);
            throw err;
        }
    }

    async writeExchangeInfoToFile(exchangeInfo) {
        try {
            fs.writeFileSync(`./exchangeInfo.json`, JSON.stringify(exchangeInfo));
        } catch (err) {
           this.instance.logger.error(`writeExchangeInfoToFile: ${err.message}`);
           throw err;
        }
    }
    
    async getBestBidPrice(symbol) {
        try {
            const orderBook = await this.instance.client.book({ symbol: symbol });
            return orderBook.bids[0].price;
        } catch (err) {
           this.instance.logger.error(`getBestBidPrice: ${err.message}`);
           throw err;
        }
    }

    async getBuyQuantity(executionReport) {
        try {
            const pairType = this.getPairType(executionReport.symbol);
            const startingValue = this.instance.strategy[`starting${pairType}`];
    
            const bestBidPrice = await this.getBestBidPrice(executionReport.symbol);
            const buyQuantity = Calc.divBy(startingValue, bestBidPrice);
            return buyQuantity;
        } catch (err) {
            this.instance.logger.error(`getBuyQuantity: ${err.message}`);
            console.error(err.message);
        }
    }

    getSellPrice(eventData) {
        try {
            let tickSize = this.exchangeInfo[eventData.symbol].tickSize;
            let increaseAmount = Calc.mul(tickSize, this.strategy.numTickIncrease);
            let buyPrice = eventData.orderType === "MARKET" ? eventData.priceLastTrade : eventData.price;
            let sellPrice = Calc.add(increaseAmount, buyPrice);
            return sellPrice;
        } catch (err) {
            this.instance.logger.error(`getSellPrice: ${err.message}`);
            throw err;
        }
    }

    getPairType(symbol) {
        try {
            let isFiat = symbol.slice(symbol.length - 4, symbol.length - 1) === "USD";
            let sliceLength = isFiat ? 4 : 3;
            return symbol.slice(symbol.length - sliceLength, symbol.length);
        } catch (err) {
           this.instance.logger.error(`getPairType: ${err.message}`);
           throw err;
        }
    }
};

function getFilterValue(value, filterName) {
    try {
        return value.filters.find((filter) => {
            return filter.hasOwnProperty(filterName);
        })[filterName];
    } catch (err) {
       this.instance.logger.error(`getFilterValue: ${err.message}`);
       throw err;
    }
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