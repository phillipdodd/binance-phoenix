require('dotenv').config();
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
                    this.handleFilledExecutionReport(eventData);
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
            this.placeMarketBuyOrder({ symbol: "ADABTC" });
        } catch (e) {
            this.logger.error(`startupActions: ${e.message}`);
        }
    }

    async completeSession() {
        //* Close websocket
        this.websockets.user();
        await this.utility.cancelAllOpenBuyOrders();
    }

    /**
     * 
     * @param {ExecutionReport} executionReport 
     */
    createGeneratorForOrder(executionReport) {
        if (!this.orderCache.hasOwnProperty(executionReport.orderId)) {
            this.orderCache[executionReport.orderID] = GeneratorFactory.createIterator(
                executionReport.price,
                this.strategy.increasePercentage
            );
        }
    }

    /**
     * 
     * @param {ExecutionReport} executionReport 
     */
    async handleFilledExecutionReport(executionReport) {
        try {
            // if (this.orderCache.length >= this.strategy.orderLimit) {
            //     this.completeSession();
            //     return;
            // }

            this.dataHandler.insert(executionReport);

            //todo if statement could be removed by placing handlers in a dictionary
            //todo -- like this: this.handlers[event.side]();
            //? are there other sides than buy/sell?
            if (executionReport.side === "BUY") {
                this.handleBuy(executionReport);
            } else if (executionReport.side === "SELL") {
                this.handleSell(executionReport);
            }
        } catch (e) {
            this.logger.error(`handleOrderEvent: ${e.message}`);
        }
    }

    /**
     * 
     * @param {ExecutionReport} executionReport 
     */
    async handleBuy(executionReport) {
        //* Create generator if one does not currently exist
        createGeneratorForOrder(executionReport);
        const orderResponse = await this.placeLimitSellOrder(executionReport);

        this.dataHandler.insert(orderResponse);
        
        //todo i do not like this prop-name changing...
        this.orderCache.renameProp(executionReport.orderId, orderResponse.orderId);
    }

    /**
     * 
     * @param {ExecutionReport} executionReport 
     */
    async handleSell(executionReport) {
        const isInPriceRange = GeneratorFactory.run(this.orderCache[executionReport.orderId], executionReport.price);
        let order = {};
        if (isInPriceRange) {
            //* Using market buy here instead to avoid things stalling out and never filling a buy order
            order = await this.placeMarketBuyOrder(executionReport);
            this.dataHandler.insert(order);
        }
    }

    /**
     * @description wrapper that ensures price and quantity are rounded to tick/step sizes
     * @param {*} options
     * @returns Order
     */
    async placeOrder(options) {
        try {
            let correctedOptions = this.utility.correctTickAndStep(options);
            let order = await this.client.order(correctedOptions);
            let price = correctedOptions.price || order.fills[0].price;
            this.logger.info(
                `Placing ${order.symbol} "${order.side}" P:${price} | Q: ${order.origQty} | T: ${Calc.mul(
                    price,
                    order.origQty
                )}`
            );
            return order;
        } catch (e) {
            this.logger.error(`placeOrder: ${e.message}`);
        }
    }

    /**
     * 
     * @param {ExecutionReport} executionReport 
     * @returns Order
     */
    async placeMarketBuyOrder(executionReport) {
        try {
            const buyQuantity = this.utility.getBuyQuantity(executionReport);
            let order = this.placeOrder({
                symbol: executionReport.symbol,
                quantity: buyQuantity,
                type: "MARKET",
                side: "BUY",
            });
            return order;
        } catch (e) {
            this.logger.error(
                `placeMarketBuyOrder: ${e.message}. Tried to place an ${executionReport.symbol} order. startingValue: ${startingValue} | buyQuantity: ${buyQuantity}`
            );
        }
    }

    /**
     * @description used in response to a filled buy order. adds a number of ticks specified by the strategy
     * and relists the same quantity in the buy order with the new increased price
     * @param {ExecutionReport} executionReport
     * @returns Order
     */
    async placeLimitSellOrder(executionReport) {
        try {
            const sellPrice = this.utility.getSellPrice(executionReport);
            let order = this.placeOrder({
                symbol: executionReport.symbol,
                price: sellPrice,
                quantity: executionReport.quantity,
                type: "LIMIT",
                side: "SELL",
            });
            return order;
        } catch (e) {
            this.logger.error(`placeLimitSellOrder: ${e.message}. Tried to place an ${executionReport.symbol} order.`);
        }
    }
}

module.exports = Instance;