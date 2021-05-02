require('dotenv').config();
const Binance = require("us-binance-api-node");
//todo calc is only used in that one log statement, could likely be ultimately removed
const Calc = require("./lib/Calc.js");
const BaseLogger = require('./lib/BaseLogger.js');
const InstanceUtility = require('./lib/InstanceUtility.js');
const DataHandler = require('./lib/DataHandler.js');
const Config = require("./data/Config.js");
const Strategies = require('./data/Strategies.js');

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
        this.strategy = Strategies[user];

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
    async startupActions() {
        try {
            const order = await this.placeLimitBuyOrder("ADABTC");
            this.createResetTimer(order.symbol, order.orderId);

            const orderb = await this.placeLimitBuyOrder("DOGEUSD");
            this.createResetTimer(orderb.symbol, orderb.orderId);
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

    async handleFilledExecutionReport(executionReport) {
        try {
            this.dataHandler.insert(executionReport);

            //todo if statement could be removed by placing handlers in a dictionary
            //todo -- like this: this.handlers[event.side]();
            //? are there other sides than buy/sell?
            if (executionReport.side === "BUY") {
                this.handleBuy(executionReport).catch((err) => {
                    throw err;
                });
            } else if (executionReport.side === "SELL") {
                this.handleSell(executionReport).catch((err) => {
                    throw err;
                });
            }
        } catch (err) {
            this.logger.error(`handleOrderEvent: ${err.message}`);
            throw err;
        }
    }

    async handleBuy(executionReport) {
        try {
            const order = await this.placeLimitSellOrder(executionReport).catch(err => { throw err });
            order.eventType = "placedOrderResponse";
            this.dataHandler.insert(order);
        } catch (err) {
            this.logger.error(`handleBuy: ${err.message}`);
            throw err;
        }
    }

    async handleSell({ symbol } = {}) {
        try {
            const order = await this.placeLimitBuyOrder(symbol).catch(err => { throw err });
            
            this.createResetTimer(symbol, order.orderId);

            order.eventType = "placedOrderResponse";
            this.dataHandler.insert(order);
        } catch (err) {
            this.logger.error(`handleSell: ${err.message}`);
            throw err;
        }
    }

    createResetTimer(symbol, orderId) {
        try {
            this.logger.info(`creating reset timer. symbol: ${symbol} | orderId: ${orderId}`);
            setTimeout(async () => {
                const isOrderFilled = await this.utility.isOrderFilled(symbol, orderId);
                if (!isOrderFilled) {
                    this.logger.info(`Resetting order ${orderId}`);
                    await this.utility.cancelOrder(symbol, orderId);
                    this.placeLimitBuyOrder(symbol);
                }
            }, Config.resetTime);
        } catch (err) {
           this.logger.error(`createResetTimer: ${err.message}`);
           throw err;
        }
    }

    async placeLimitBuyOrder(symbol) {
        const price = await this.utility.getBestBidPrice(symbol);
        const quantity = await this.utility.getBuyQuantity(symbol, price);
        return await this.placeOrder({
            symbol,
            quantity,
            price,
            type: "LIMIT",
            side: "BUY",
        });
    }

    async placeLimitSellOrder(executionReport) {
        try {
            const { symbol, quantity } = executionReport;
            const price = await this.utility.getSellPrice(executionReport);
            let order = this.placeOrder({
                symbol,
                price,
                quantity,
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

    async placeOrder(options) {
        try {
            let correctedOptions = this.utility.correctTickAndStep(options);
            let order = await this.client.order(correctedOptions);
            let price = correctedOptions.price || order.fills[0].price;
            this.logger.info(
                `Placing ${order.symbol} "${order.side}" P:${price} | Q: ${order.origQty} | T: ${Calc.mul(price, order.origQty)}`
            );
            return order;
        } catch (err) {
            this.logger.error(`placeOrder: ${err.message}`);
            throw err;
        }
    }

    async placeMarketBuyOrder(executionReport) {
        try {
            const bestBidPrice = await this.utility.bestBidPrice(executionReport.symbol);
            const buyQuantity = await this.utility.getBuyQuantity(executionReport.symbol, bestBidPrice);
            let order = this.placeOrder({
                symbol: executionReport.symbol,
                quantity: buyQuantity,
                type: "MARKET",
                side: "BUY",
            }).catch((err) => {
                throw err;
            });
            return order;
        } catch (err) {
            this.logger.error(
                `placeMarketBuyOrder: ${err.message}. Tried to place an ${executionReport.symbol} order. startingValue: ${startingValue} | buyQuantity: ${buyQuantity}`
            );
            throw err;
        }
    }
}

module.exports = Instance;