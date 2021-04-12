const Binance = require("us-binance-api-node");
//todo calc is only used in that one log statement, could likely be ultimately removed
const Calc = require("./lib/Calc.js");
const BaseLogger = require('./lib/BaseLogger.js');
const InstanceUtility = require('./lib/InstanceUtility.js');
const DataHandler = require('./lib/DataHandler.js');
const GeneratorFactory = require('./lib/GeneratorFactory.js');

class Instance {
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

    createGeneratorForOrder(eventData) {
        if (!this.orderCache.hasOwnProperty(eventData.orderId)) {
            this.orderCache[eventData.orderID] = GeneratorFactory.createIterator(
                eventData.price,
                this.strategy.increasePercentage
            );
        }
    }

    async handleOrderEvent(eventData) {
        try {
            if (this.orderCache.long >= this.strategy.orderLimit) {
                this.completeSession();
                return;
            }

            this.dataHandler.insert(eventData);


            //todo if statement could be removed by placing handlers in a dictionary
            //todo -- like this: this.handlers[event.side]();
            if (eventData.side === "BUY") {
                this.handleBuy(eventData);
            } else if (eventData.side === "SELL") {
                this.handleSell(eventData);
            }
        } catch (e) {
            this.logger.error(`handleOrderEvent: ${e.message}`);
        }
    }

    async handleBuy(eventData) {
        //* Create generator if one does not currently exist
        createGeneratorForOrder(eventData);
        const limitSellOrder = await this.placeLimitSellOrder(eventData);
        //todo i do not like this prop-name changing...
        this.orderCache.renameProp(eventData.orderId, limitSellOrder.orderId);
    }

    async handleSell(eventData) {
        const isInPriceRange = GeneratorFactory.run(this.orderCache[eventData.orderId], eventData.price);
        if (isInPriceRange) {
            //* Using market buy here instead to avoid things stalling out and never filling a buy order
            this.placeMarketBuyOrder(eventData);
        }
    }

    /**
     * @description wrapper that ensures price and quantity are rounded to tick/step sizes
     * @param {*} options
     */
    async placeOrder(options) {
        try {
            let correctedOptions = this.utility.correctTickAndStep(options);
            let orderResponse = await this.client.order(correctedOptions);
            let price = correctedOptions.price || orderResponse.fills[0].price;
            this.logger.info(
                `Placing ${orderResponse.symbol} "${orderResponse.side}" P:${price} | Q: ${orderResponse.origQty} | T: ${Calc.mul(
                    price,
                    orderResponse.origQty
                )}`
            );
            this.dataHandler.insert(orderResponse);

            return orderResponse;
        } catch (e) {
            this.logger.error(`placeOrder: ${e.message}`);
        }
    }

    async placeMarketBuyOrder(eventData) {
        try {
            const buyQuantity = this.utility.getBuyQuantity(eventData);
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
            const sellPrice = this.utility.getSellPrice(eventData);
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

module.exports = Instance;