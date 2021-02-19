require("dotenv").config();

const Binance = require("us-binance-api-node").default;
const fs = require("fs");
const calc = require("./lib/calc");
const exchangeInfo = require("./exchangeInfo.json");
class Instance {
    
    /**
     * 
     * @param {string} apiKey 
     * @param {string} apiSecret
     * todo change user to use constant
     * @param {string} user 
     * @param {number} increasePercentage 
     * @param {object} strategy 
     */
    constructor(apiKey, apiSecret, user, increasePercentage, strategy) {
        this.websockets = {};
        this.client = Binance({
            apiKey: apiKey,
            apiSecret: apiSecret,
            getTime: Date.now,
        });
        this.user = user;
        this.increasePercentage = increasePercentage;
        this.strategy = strategy;

        //todo does this data need to live somewhere else?
        this.filledSellOrders = [];

        this.logger = require("./lib/myWinston")(`instance_${user}`);
    }

    async init() {
        try {
            await this.writeExchangeInfoToFile();
            this.logger.info("exchangeInfo.json up to date.");

            let handleFilledMarketBuy = (eventData) => {
                //? spacing to line up with sell's in console
                this.logger.info(`Filled  ${eventData.symbol} "BUY" P:${eventData.priceLastTrade} | Q: ${eventData.quantity}`);
                this.placeLimitSellOrder(eventData);
            };

            let handleFilledLimitBuy = (eventData) => {
                try {
                    if (this.filledSellOrders.length <= this.strategy.orderLimit) {
                        this.placeLimitSellOrder(eventData);
                    } else {
                        this.completeSession();
                    }
                } catch (e) {
                    this.logger.error(`handleFilledLimitBuy: ${e.message}`);
                }
            }

            let handleFilledLimitSell = (eventData) => {
                try {
                    this.filledSellOrders.push(eventData);
                    this.placeLimitBuyOrder(eventData);
                } catch (e) {
                    this.logger.error(`handleFilledLimitSell: ${e.message}`);
                }
            };

            this.websockets.user = this.client.ws.user((eventData) => {
                if (eventData.orderStatus === "FILLED") {
                    if (!this.strategy[eventData.symbol]) {
                        throw new Error(`Referenced strategy does not include the pair ${eventData.symbol}`);
                    }
                    if (eventData.side === "BUY") handleFilledLimitBuy(eventData);
                    if (eventData.side === "SELL") handleFilledLimitSell(eventData);
                }
            });

            this.logger.info(`Instance initiated`);
        } catch (e) {
            this.logger.error(`init: ${e.message}`);
        }

        //* Single execution at start of session
        this.carpetBomb({ symbol: "ADABTC", numOrders: 1, ticksApart: 5 });
    }

    async getExchangeInfo() {
        try {
            let exchangeInfo = await this.client.exchangeInfo();
            let simplifiedExchangeInfo = {};
            let getFilterValue = (value, filterName) => {
                return value.filters.find((filter) => {
                    return filter.hasOwnProperty(filterName);
                })[filterName];
            };

            exchangeInfo.symbols.forEach((v) => {
                simplifiedExchangeInfo[v.symbol] = {
                    baseAsset: v.baseAsset,
                    quoteAsset: v.quoteAsset,
                    quotePrecision: v.quotePrecision,
                    status: v.status,
                    tickSize: getFilterValue(v, "tickSize"),
                    stepSize: getFilterValue(v, "stepSize"),
                    minNotional: getFilterValue(v, "minNotional"),
                };
            });

            return simplifiedExchangeInfo;
        } catch (e) {
            this.logger.error(e.message);
        }
    }

    async writeExchangeInfoToFile() {
        let exchangeInfo = await this.getExchangeInfo();
        fs.writeFileSync(`./exchangeInfo.json`, JSON.stringify(exchangeInfo));
    }

    /**
     * @description wrapper that ensures price and quantity are rounded to tick/step sizes
     * @param {*} options
     */
    async placeOrder(options) {
        try {
            options.price = calc.roundToTickSize(options.price, exchangeInfo[options.symbol].tickSize);
            options.quantity = calc.roundToStepSize(options.quantity, exchangeInfo[options.symbol].stepSize);
            this.logger.info(`Placing ${options.symbol} "${options.side}" P:${options.price} | Q: ${options.quantity} | T: ${calc.mul(options.price, options.quantity)}`);
            let order = await this.client.order(options);
            return order;
        } catch (e) {
            this.logger.error(`placeOrder: ${e.message}`);
        }
    }

    async placeLimitBuyOrder(eventData) {
        try {
            let startingBTC = this.strategy[eventData.symbol].startingBTC;
            let marketValue = await this.getBestBidPrice(eventData.symbol);
            let buyQuantity = calc.divBy(startingBTC, marketValue);

            this.placeOrder({
                symbol: eventData.symbol,
                price: marketValue,
                quantity: buyQuantity,
                type: "LIMIT",
                side: "BUY"
            });
        } catch (e) {
            this.logger.error(`placeLimitBuyOrder: ${e.message}`);
        }
    }

    async placeLimitSellOrder(eventData) {
        try {
            let targetBTC = this.strategy[eventData.symbol].targetBTC;
            let sellPrice = calc.divBy(targetBTC, eventData.quantity);

            this.placeOrder({
                symbol: eventData.symbol,
                price: sellPrice,
                quantity: eventData.quantity,
                type: "LIMIT",
                side: "SELL"
            });
        } catch (e) {
            this.logger.error(`placeLimitSellOrder: ${e.message}`);
        }
    }

    async getBestBidPrice(symbol) {
            const orderBook = await this.client.book({ symbol: symbol });
            return orderBook.bids[0];
    }

    async carpetBomb(options) {
        try {
            const orderBook = await this.client.book({ symbol: options.symbol });
            const bestBid = orderBook.bids[0].price;
            const tickSize = exchangeInfo[options.symbol].tickSize;
            const distance = tickSize * options.ticksApart;

            for (let i = 0; i < options.numOrders; i++) {
                let price = calc.add(bestBid, distance * i);
                console.log(`price: ${price}`);
                let order = await this.client.order({
                    symbol: options.symbol,
                    quantity: this.strategy[options.symbol].quantity,
                    type: "LIMIT",
                    side: "BUY",
                    price: price,
                });
                this.logger.info(`Placed ${options.symbol} buy order for ${price}`);
            }
        } catch (e) {
            this.logger.error(`carpetBomb: ${e.message}`);
        }
    }

    async completeSession() { 
        //* Close websocket
        this.websockets.user();
        await this.cancelAllOpenBuyOrders();
        //todo replace with db
        fs.writeFileSync(`./filledSellOrders.json`, JSON.stringify(this.filledSellOrders));
    }
    
    async cancelAllOpenBuyOrders() {
        let orders = await this.client.openOrders();
        orders
            .filter((order) => order.side === "BUY")
            .forEach((order) => {
                this.client.cancelOrder({
                    symbol: order.symbol,
                    orderId: order.orderId,
                });
            });
    }

}

module.exports = Instance;
