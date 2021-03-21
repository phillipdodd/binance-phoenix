// const Binance = require("us-binance-api-node").default;
import Binance from "us-binance-api-node";
import fs from "fs";
import { Calc } from "./lib/Calc.js";
import { BaseLogger } from "./lib/BaseLogger.js";
import { DataHandler } from "./lib/DataHandler.js";

//todo have this read from the db
const exchangeInfo = JSON.parse(fs.readFileSync("./exchangeInfo.json"));

export class Instance {
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

        this.filledSellOrders = [];
        this.orderDataHandler = new DataHandler(user);

        this.logger = new BaseLogger(`instance_${user}`).init();
    }

    async init() {
        try {
            await this.updateExchangeInfo();
            this.websockets.user = this.client.ws.user((eventData) => {
                try {
                    if (eventData.orderStatus === "FILLED") this.handleOrderEvent(eventData);
                } catch (e) {
                    this.logger.error(`handleUserEvent: ${e.message}`);
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
        await this.cancelAllOpenBuyOrders();
        //todo replace with db
        fs.writeFileSync(`./filledSellOrders.json`, JSON.stringify(this.filledSellOrders));
    }

    //todo handler manager
    handleOrderEvent(eventData) {
        try {
            if (eventData.side === "BUY") this.handleFilledBuy(eventData);
            if (eventData.side === "SELL") this.handleFilledSell(eventData);
        } catch (e) {
            this.logger.error(`handleOrderEvent: ${e.message}`);
        }
    }

    //todo handler manager
    handleFilledBuy(eventData) {
        try {
            if (this.filledSellOrders.length <= this.strategy.orderLimit) {
                this.orderDataHandler.insert(eventData);
                this.placeLimitSellOrder(eventData);
            } else {
                this.completeSession();
            }
        } catch (e) {
            this.logger.error(`handleFilledBuy: ${e.message}`);
        }
    }

    //todo handler manager
    handleFilledSell(eventData) {
        try {
            this.filledSellOrders.push(eventData);
            this.orderDataHandler.insert(eventData);

            //* Using market buy here instead to avoid things stalling out and never filling a buy order
            this.placeMarketBuyOrder(eventData);
        } catch (e) {
            this.logger.error(`handleFilledSell: ${e.message}`);
        }
    }

    //todo exchangeInfo needs to be in a db, not a flat file
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

    async updateExchangeInfo() {
        try {
            await this.writeExchangeInfoToFile();
            this.logger.info("exchangeInfo.json up to date.");
        } catch (e) {
            this.logger.error(`updateExchangeInfo: ${e.message}`);
        }
    }

    async writeExchangeInfoToFile() {
        let exchangeInfo = await this.getExchangeInfo();
        fs.writeFileSync(`./exchangeInfo.json`, JSON.stringify(exchangeInfo));
    }

    //todo tick/step rounds need to happen in a more obvious place. this is a misleading function
    /**
     * @description wrapper that ensures price and quantity are rounded to tick/step sizes
     * @param {*} options
     */
    async placeOrder(options) {
        try {
            options.quantity = Calc.roundToStepSize(options.quantity, exchangeInfo[options.symbol].stepSize);

            //* Market orders will not be including a 'price' property
            if (options.hasOwnProperty("price")) {
                options.price = Calc.roundToTickSize(options.price, exchangeInfo[options.symbol].tickSize);
            }
            let order = await this.client.order(options);

            let price = options.price || order.fills[0].price;
            this.logger.info(
                `Placing ${order.symbol} "${order.side}" P:${price} | Q: ${order.origQty} | T: ${Calc.mul(price, order.origQty)}`
            );
            this.orderDataHandler.insert(order);

            return order;
        } catch (e) {
            this.logger.error(`placeOrder: ${e.message}`);
        }
    }

    async placeMarketBuyOrder(eventData) {
        try {
            let pairType = this.getPairType(eventData.symbol);
            let startingValue = this.strategy[`starting${pairType}`];

            let bestBidPrice = await this.getBestBidPrice(eventData.symbol);
            let buyQuantity = Calc.divBy(startingValue, bestBidPrice);
            this.placeOrder({
                symbol: eventData.symbol,
                quantity: buyQuantity,
                type: "MARKET",
                side: "BUY",
            });
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
            let tickSize = exchangeInfo[eventData.symbol].tickSize;
            let increaseAmount = Calc.mul(tickSize, this.strategy.numTickIncrease);
            this.logger.debug(`increaseAmount: ${increaseAmount}`);
            let buyPrice = eventData.orderType === "MARKET" ? eventData.priceLastTrade : eventData.price;
            this.logger.debug(`buyPrice: ${buyPrice}`);
            let sellPrice = Calc.add(increaseAmount, buyPrice);

            let order = this.placeOrder({
                symbol: eventData.symbol,
                price: sellPrice,
                quantity: eventData.quantity,
                type: "LIMIT",
                side: "SELL",
            });
        } catch (e) {
            this.logger.error(`placeLimitSellOrder: ${e.message}. Tried to place an ${eventData.symbol} order.`);
        }
    }

    async getBestBidPrice(symbol) {
        const orderBook = await this.client.book({ symbol: symbol });
        return orderBook.bids[0].price;
    }

    async carpetBomb(options) {
        try {
            const orderBook = await this.client.book({ symbol: options.symbol });
            const bestBid = orderBook.bids[0].price;
            const tickSize = exchangeInfo[options.symbol].tickSize;
            const distance = tickSize * options.ticksApart;

            for (let i = 0; i < options.numOrders; i++) {
                let price = Calc.add(bestBid, distance * i);
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

    //todo utility class?
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

    getPairType(symbol) {
        let isFiat = symbol.slice(symbol.length - 4, symbol.length - 1) === "USD";
        let sliceLength = isFiat ? 4 : 3;
        return symbol.slice(symbol.length - sliceLength, symbol.length);
    }
}
