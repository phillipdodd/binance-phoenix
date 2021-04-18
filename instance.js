require('dotenv').config();
const Binance = require("us-binance-api-node");
//todo calc is only used in that one log statement, could likely be ultimately removed
const Calc = require("./lib/Calc.js");
const BaseLogger = require('./lib/BaseLogger.js');
const InstanceUtility = require('./lib/InstanceUtility.js');
const DataHandler = require('./lib/DataHandler.js');
const GeneratorFactory = require('./lib/GeneratorFactory.js');
const GeneratorCache = require('./lib/GeneratorCache.js');

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
        
        this.generatorCache = new GeneratorCache();
        
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
            }, 1000);
        } catch (err) {
            this.logger.error(`init: ${err.message}`);
            throw err;
        }
    }

    /**
     * @description actions to execute a single time after instance has been initialized
     */
    startupActions() {
        try {
            this.placeMarketBuyOrder({ symbol: "ADABTC" });
        } catch (err) {
            this.logger.error(`startupActions: ${err.message}`);
            throw err;
        }
    }

    async completeSession() {
        try {
            //* Close websocket
            this.websockets.user();
            await this.utility.cancelAllOpenBuyOrders();
        } catch (err) {
           this.logger.error(`completeSession: ${err.message}`);
           throw err;
        }
    }

    /**
     * 
     * @param {ExecutionReport} executionReport 
     */
    createGeneratorForOrder(executionReport) {
        try {
            this.logger.info(`createGeneratorForOrder(): executionReport.orderId is ${executionReport.orderId}`);
            let generator = this.generatorCache.getGeneratorForOrderID(executionReport.orderId);
            this.logger.info(`createGeneratorForOrder(): generator is ${generator}`);
            if (!generator) {
                generator = GeneratorFactory.createIterator(getPriceValue(executionReport), this.strategy.increasePercentage);
                this.generatorCache.addGeneratorForOrderID(generator, executionReport.orderId);
            }
        } catch (err) {
           this.logger.error(`createGeneratorForOrder: ${err.message}`);
           throw err;
        }
    }

    /**
     * 
     * @param {ExecutionReport} executionReport 
     */
    async handleFilledExecutionReport(executionReport) {
        try {
            // if (this.generatorCache.getTotalNumberOfGenerators() >= this.strategy.orderLimit) {
            //     this.completeSession();
            //     return;
            // }

            this.dataHandler.insert(executionReport);

            //todo if statement could be removed by placing handlers in a dictionary
            //todo -- like this: this.handlers[event.side]();
            //? are there other sides than buy/sell?
            if (executionReport.side === "BUY") {
                this.handleBuy(executionReport).catch(err => { throw err; });
            } else if (executionReport.side === "SELL") {
                this.handleSell(executionReport).catch(err => { throw err; });
            }
        } catch (err) {
            this.logger.error(`handleOrderEvent: ${err.message}`);
            throw err;
        }
    }

    /**
     * 
     * @param {ExecutionReport} executionReport 
     */
    async handleBuy(executionReport) {
        try {
            //* Create generator if one does not currently exist
            this.createGeneratorForOrder(executionReport);
            const orderResponse = await this.placeLimitSellOrder(executionReport);
            this.generatorCache.updateGeneratorKey(executionReport.orderId, orderResponse.orderId);
        } catch (err) {
           this.logger.error(`handleBuy: ${err.message}`);
           throw err;
        }
    }

    /**
     * 
     * @param {ExecutionReport} executionReport 
     */
    async handleSell(executionReport) {
        try {
            this.logger.info("handleSell() beginning");
            const generator = this.generatorCache.getGeneratorForOrderID(executionReport.orderId);
            if (!generator) {this.logger.error(`No generator returned for orderId ${executionReport.orderId}`)}
            const isInPriceRange = GeneratorFactory.run(generator, executionReport.price);
            this.logger.info(`Price of ${executionReport.price} returned ${isInPriceRange} for isInPriceRange`);
            let order = {};
            if (isInPriceRange) {
                //* Using market buy here instead to avoid things stalling out and never filling a buy order
                order = await this.placeMarketBuyOrder(executionReport);
                order.eventType = 'placedOrderResponse';
                this.dataHandler.insert(order);
            }
        } catch (err) {
            console.dir(this.generatorCache.generators);
            this.logger.error(`handleSell: ${err.message}`);
            throw err;
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
        } catch (err) {
            this.logger.error(`placeOrder: ${err.message}`);
            throw err;
        }
    }

    /**
     * 
     * @param {ExecutionReport} executionReport 
     * @returns Order
     */
    async placeMarketBuyOrder(executionReport) {
        try {
            const buyQuantity = await this.utility.getBuyQuantity(executionReport);
            let order = this.placeOrder({
                symbol: executionReport.symbol,
                quantity: buyQuantity,
                type: "MARKET",
                side: "BUY",
            }).catch(err => {throw err});
            return order;
        } catch (err) {
            this.logger.error(
                `placeMarketBuyOrder: ${err.message}. Tried to place an ${executionReport.symbol} order. startingValue: ${startingValue} | buyQuantity: ${buyQuantity}`
            );
            throw err;
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
            }).catch((err) => {
                throw err;
            });
            return order;
        } catch (err) {
            this.logger.error(`placeLimitSellOrder: ${err.message}. Tried to place an ${executionReport.symbol} order.`);
            throw err;
        }
    }
}

function getPriceValue({ price, priceLastTrade } = {}) {
    if (price && Number(price)) {
        return price;
    } else {
        return priceLastTrade;
    }
}

module.exports = Instance;