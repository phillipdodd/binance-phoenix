require('dotenv').config();
const Binance = require("us-binance-api-node");
//todo calc is only used in that one log statement, could likely be ultimately removed
const Calc = require("./lib/Calc.js");
const BaseLogger = require('./lib/BaseLogger.js');
const InstanceUtility = require('./lib/InstanceUtility.js');
const DataHandler = require('./lib/DataHandler.js');
const { config, strategies } = require('./data/constants.js');

class Instance {
    constructor(user) {
        this.websockets = {};
        this.client = Binance.default({
            apiKey: process.env[`API_KEY_${user}`],
            apiSecret: process.env[`API_SECRET_${user}`],
            getTime: Date.now,
        });

        this.user = user;
        this.strategy = strategies[user];

        this.symbolLimits = {};

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
            for (const pair of this.strategy.initPairs) {
                await this.initPair(pair);
            }
        } catch (err) {
            this.logger.error(`startupActions: ${err.message}`);
            throw err;
        }
    }

    async initPair(symbol) {
        try {
            const { orderId } = await this.placeLimitBuyOrder(symbol);
            this.createResetTimer(symbol, orderId);
            this.symbolLimits[symbol] = this.strategy.orderLimit;
        } catch (err) {
           this.logger.error(`initPair: ${err.message}`);
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
            if (executionReport.side === "BUY") {
                this.handleBuy(executionReport).catch((err) => { throw err; });
            } else if (executionReport.side === "SELL") {
                this.handleSell(executionReport).catch((err) => { throw err; });
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
            if (!order) return;

            this.createResetTimer(symbol, order.orderId);

            order.eventType = "placedOrderResponse";
            this.dataHandler.insert(order);

            this.logger.info(JSON.stringify(`symbolLimits: ${JSON.stringify(this.symbolLimits)}`));
        } catch (err) {
            this.logger.error(`handleSell: ${err.message}`);
            throw err;
        }
    }

    async createResetTimer(symbol, orderId) {
        try {
            setTimeout(async () => {
                const isOrderFilled = await this.utility.isOrderFilled(symbol, orderId).catch(err => { throw err; });
                if (!isOrderFilled) {
                    this.logger.info(`Resetting ${symbol} ${orderId}`);
                    await this.utility.cancelOrder(symbol, orderId).catch(err => { throw err; });
                    const newOrder = await this.placeLimitBuyOrder(symbol).catch(err => { throw err; });
                    this.createResetTimer(symbol, newOrder.orderId);
                }
            }, config.resetTime);
        } catch (err) {
            this.logger.error(`createResetTimer: ${err.message}`);
            throw err;
        }
    }

    async placeLimitBuyOrder(symbol) {
        
        if (this.symbolLimits[symbol] < 1) return;

        const price = await this.utility.getBestBidPrice(symbol);
        const quantity = await this.utility.getBuyQuantity(symbol, price);
        const order = await this.placeOrder({
            symbol,
            quantity,
            price,
            type: "LIMIT",
            side: "BUY",
        });

        this.symbolLimits[symbol]--;
        return order;
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
                `Placing ${order.symbol} "${order.side}" - ${price}`
                // `Placing ${order.symbol} "${order.side}" P:${price} | Q: ${order.origQty} | T: ${Calc.mul(price, order.origQty)}`
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