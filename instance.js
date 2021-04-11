const Binance = require("us-binance-api-node");
const Calc = require("./lib/Calc.js");
const BaseLogger = require('./lib/BaseLogger.js');
const InstanceUtility = require('./lib/InstanceUtility.js');
const DataHandler = require('./lib/DataHandler.js');
const GeneratorFactory = require('./lib/GeneratorFactory.js');

module.exports = class Instance {
    /**
     *
     * @param {string} user
     * @param {object} strategy
     */
    constructor(user, strategy) {
        this.websockets = {};
        this.client = Binance.default({
            apiKey: process.env[`API_KEY_${user}`],
            apiSecret: process.env[`API_SECRET_${user}`],
            getTime: Date.now,
        });
        this.user = user;
        this.strategy = strategy;

        this.orderCache = {};
        
        this.dataHandler = new DataHandler(user);
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

    async handleOrderEvent(eventData) {
        try {
            if (this.orderCache.long >= this.strategy.orderLimit) {
                this.completeSession();
                return;
            }

            this.dataHandler.insert(eventData);

            if (eventData.side === "BUY") {
                
                //* Create generator if one does not currently exist
                if (!this.orderCache.hasOwnProperty(eventData.orderId)) {
                    this.orderCache[marketBuyOrder.orderID] = GeneratorFactory.createIterator(
                        marketBuyOrder.price,
                        this.strategy.increasePercentage
                    );
                }

                const limitSellOrder = await this.placeLimitSellOrder(eventData);
                this.orderCache.renameProp(eventData.orderId, limitSellOrder.orderId);

            } else if (eventData.side === "SELL") {

                const isInPriceRange = GeneratorFactory.run(this.orderCache[eventData.orderId], eventData.price);
                if (isInPriceRange) {
                    //* Using market buy here instead to avoid things stalling out and never filling a buy order
                    this.placeMarketBuyOrder(eventData);
                }
                
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
            this.dataHandler.insert(orderResponse);

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