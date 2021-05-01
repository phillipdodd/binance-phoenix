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

    async cancelOrder(symbol, orderId) {
        try {
            return await this.instance.client.cancelOrder({ symbol, orderId });
        } catch (err) {
           this.logger.error(`cancelOrder: ${err.message}`);
           throw err;
        }
    }
    
    async getBestBidPrice(symbol) {
        try {
            const { bids } = await this.instance.client.book({ symbol });
            return bids[0].price;
        } catch (err) {
            this.instance.logger.error(`getBestBidPrice: ${err.message}`);
            throw err;
        }
    }

    async getLowestAskPrice(symbol) {
        try {
            const { asks } = await this.instance.client.book({ symbol });
            return asks[0].price;
        } catch (err) {
            this.instance.logger.error(`getBestBidPrice: ${err.message}`);
            throw err;
        }
    }
    
    async getOrderBookGap(symbol) {
        try {
            const { bids, asks } = await this.instance.client.book({ symbol });
            return { highestBid: bids[0], lowestAsk: asks[0] }
        } catch (err) {
            this.instance.logger.error(`getOrderBookGap: ${err.message}`);
            throw err;
        }
    }

    async getTicksInGap(symbol) {
        try {
            const { lowestAsk, highestBid } = await this.getOrderBookGap(symbol);
            const gap = Calc.getAbsDiff(lowestAsk, highestBid);
            return Calc.div(gap, this.exchangeInfo[symbol].tickSize);
        } catch (err) {
           this.instance.logger.error(`getTicksInGap: ${err.message}`);
           throw err;
        }
    }

    async getBuyQuantity(symbol, bestBidPrice) {
        try {
            const pairType = this.getPairType(symbol);
            const startingValue = this.instance.strategy[`starting${pairType}`];
            const buyQuantity = Calc.div(startingValue, bestBidPrice);
            return buyQuantity;
        } catch (err) {
            this.instance.logger.error(`getBuyQuantity: ${err.message}`);
            console.error(err.message);
        }
    }

    async getSellPrice(executionReport) {
        try {
            const tickIncrease = this.getTickIncreasePrice(executionReport);
            const lowestAsk = await this.getLowestAskPrice(executionReport.symbol);
            this.instance.logger.info(`getSellPrice() -  tickIncrease: ${tickIncrease}`);
            this.instance.logger.info(`getSellPrice() - lowestAsk: ${lowestAsk}`);
            return Math.max(+tickIncrease, +lowestAsk);
        } catch (err) {
            this.instance.logger.error(`getSellPrice: ${err.message}`);
            throw err;
        }
    }

    getTickIncreasePrice(executionReport) {
        let tickSize = this.exchangeInfo[executionReport.symbol].tickSize;
        let increaseAmount = Calc.mul(tickSize, this.instance.strategy.numTickIncrease);
        let buyPrice = getPriceValue(executionReport);
        return Calc.add(increaseAmount, buyPrice);
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

    async isOrderFilled(symbol, orderId) {
        try {
            const { status } = await this.instance.client.getOrder({ symbol, orderId });
            this.instance.logger.info(`isOrderFilled() - order ${orderId} for ${symbol} is ${status === "FILLED"}`);
            return status === "FILLED";
        } catch (err) {
           this.logger.error(`isOrderFilled: ${err.message}`);
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

function getPriceValue({ price, priceLastTrade } = {}) {
    if (price && !isNaN(price)) {
        return price;
    } else {
        return priceLastTrade;
    }
}

module.exports = InstanceUtility;