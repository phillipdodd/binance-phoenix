const Binance = require("us-binance-api-node");
const Calc = require("./lib/Calc.js");
const BaseLogger = require('./lib/BaseLogger.js');
const InstanceUtility = require('./lib/InstanceUtility.js');
const DataHandler = require('./lib/DataHandler.js');

module.exports = class Instance {
    /**
     *
     * @param {string} apiKey
     * @param {string} apiSecret
     * @param {string} user
     * @param {object} strategy
     */
    constructor(apiKey, apiSecret, user, strategy) {
        this.websockets = {};
        this.client = Binance.default({
            apiKey: apiKey,
            apiSecret: apiSecret,
            getTime: Date.now,
        });
        this.user = user;
        this.strategy = strategy;

        this.orderCache = 0;
        
        this.orderDataHandler = new DataHandler(user);
        this.logger = new BaseLogger(`instance_${user}`).init();
        this.utility = new InstanceUtility(this);
    }

    async init() {
        try {
            await this.utility.updateExchangeInfo();
            this.websockets.user = this.client.ws.user((eventData) => {
                if (eventData.orderStatus === "FILLED") {
                    this.handleOrderEvent(eventData);
                }
            });
            this.logger.info(`Instance initialized`);

            setTimeout(() => {
                this.startupActions();
            }, 10000);
        } catch (e) {
            this.logger.error(`init: ${e.message}`);
        }
    }

    /**
     * @description actions to execute a single time after instance has been initialized
     */
    startupActions() {
        try {
            // this.placeMarketBuyOrder({ symbol: "ADABTC" });
        } catch (e) {
            this.logger.error(`startupActions: ${e.message}`);
        }
    }

    async completeSession() {
        //* Close websocket
        this.websockets.user();
        await this.utility.cancelAllOpenBuyOrders();
    }

    handleOrderEvent(eventData) {
        try {
            if (this.orderCache.long >= this.strategy.orderLimit) {
                this.completeSession();
                return;
            }

            this.orderDataHandler.insert(eventData);

            if (eventData.side === "BUY") {
                this.placeLimitSellOrder(eventData);
            } else if (eventData.side === "SELL") {
                //* Using market buy here instead to avoid things stalling out and never filling a buy order
                let marketBuyOrder = this.placeMarketBuyOrder(eventData);
                this.orderCache[marketBuyOrder.orderID] = 
            }
        } catch (e) {
            this.logger.error(`handleOrderEvent: ${e.message}`);
        }
    }

    /**
     * @description wrapper that ensures price and quantity are rounded to tick/step sizes
     * @param {*} options
     */
    async placeOrder(options) {
        try {
            let orderResponse = await this.client.order(correctTickAndStep(options));
            let price = correctedOptions.price || orderResponse.fills[0].price;
            this.logger.info(
                `Placing ${orderResponse.symbol} "${orderResponse.side}" P:${price} | Q: ${orderResponse.origQty} | T: ${Calc.mul(price, orderResponse.origQty)}`
            );
            this.orderDataHandler.insert(orderResponse);

            return orderResponse;
        } catch (e) {
            this.logger.error(`placeOrder: ${e.message}`);
        }
    }

    async placeMarketBuyOrder(eventData) {
        try {
            const buyQuantity = getBuyQuantity(eventData);
            let orderResponse = this.placeOrder({
                symbol: eventData.symbol,
                quantity: buyQuantity,
                type: "MARKET",
                side: "BUY",
            });
            return orderResponse;
        } catch (e) {
            this.logger.error(
                `placeMarketBuyOrder: ${e.message}. Tried to place an ${eventData.symbol} order. startingValue: ${startingValue} | buyQuantity: ${buyQuantity}`
            );
        }
    }

    /**
     * @description used in response to a filled buy order. adds a number of ticks specified by the strategy
     * and relists the same quantity in the buy order with the new increased price
     * @param {*} eventData
     */
    async placeLimitSellOrder(eventData) {
        try {
            const sellPrice = getSellPrice(eventData);
            let orderResponse = this.placeOrder({
                symbol: eventData.symbol,
                price: sellPrice,
                quantity: eventData.quantity,
                type: "LIMIT",
                side: "SELL",
            });
            return orderResponse;
        } catch (e) {
            this.logger.error(`placeLimitSellOrder: ${e.message}. Tried to place an ${eventData.symbol} order.`);
        }
    }
}

function getBuyQuantity(eventData) {
    const pairType = this.getPairType(eventData.symbol);
    const startingValue = this.strategy[`starting${pairType}`];

    const bestBidPrice = await this.getBestBidPrice(eventData.symbol);
    const buyQuantity = Calc.divBy(startingValue, bestBidPrice);
    return buyQuantity;
}

function getSellPrice(eventData) {
    let tickSize = exchangeInfo[eventData.symbol].tickSize;
    let increaseAmount = Calc.mul(tickSize, this.strategy.numTickIncrease);
    this.logger.debug(`increaseAmount: ${increaseAmount}`);
    let buyPrice = eventData.orderType === "MARKET" ? eventData.priceLastTrade : eventData.price;
    this.logger.debug(`buyPrice: ${buyPrice}`);
    let sellPrice = Calc.add(increaseAmount, buyPrice);
    return sellPrice;
}

function correctTickAndStep(options) {
    try {
        //* Market orders will not be including a 'price' property
        if (options.hasOwnProperty("price")) {
            options.price = Calc.roundToTickSize(options.price, exchangeInfo[options.symbol].tickSize);
        }

        if (options.hasOwnProperty("quantity")) {
            options.quantity = Calc.roundToStepSize(options.quantity, exchangeInfo[options.symbol].stepSize);
        }

        return options;
    } catch (e) {
        this.logger.error(`correctTickAndStep: ${e.message}`);
    }
}