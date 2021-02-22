// const Binance = require("us-binance-api-node").default;
import Binance from "us-binance-api-node";
import fs from "fs";
import { Calc } from "./lib/Calc.js";
import { BaseLogger } from "./lib/BaseLogger.js";
import { DataHandler } from "./lib/DataHandler.js";

const exchangeInfo = JSON.parse(fs.readFileSync("./exchangeInfo.json"));
export class Instance {
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
        this.client = Binance.default({
            apiKey: apiKey,
            apiSecret: apiSecret,
            getTime: Date.now,
        });
        this.user = user;
        this.increasePercentage = increasePercentage;
        this.strategy = strategy;

        this.filledSellOrders = [];
        this.orderDataHandler = new DataHandler(user);

        this.logger = new BaseLogger(`instance_${user}`).init();
    }

    async init() {
        try {
            await updateExchangeInfo();
            this.websockets.user = this.client.ws.user(this.handleUserEvent);
            this.logger.info(`Instance initiated`);
            this.startupActions();
        } catch (e) {
            this.logger.error(`init: ${e.message}`);
        }
    }

    /**
     * @description actions to execute a single time after instance has been initialized
     */
    startupActions() {}

    //todo have this write to database
    async updateExchangeInfo() {
        try {
            await this.writeExchangeInfoToFile();
            this.logger.info("exchangeInfo.json up to date.");
        } catch (e) {
            this.logger.error(`updateExchangeInfo: ${e.message}`);
        }
    }

    handleUserEvent(eventData) {
        if (eventData.orderStatus === "FILLED") this.handleOrderEvent(eventData);
    }

    handleOrderEvent(eventData) {
        if (eventData.side === "BUY") this.handleFilledBuy(eventData);
        if (eventData.side === "SELL") this.handleFilledSell(eventData);
    }

    handleFilledBuy(eventData) {
        try {
            if (this.filledSellOrders.length <= this.strategy.orderLimit) {
                this.placeLimitSellOrder(eventData);
            } else {
                this.completeSession();
            }
        } catch (e) {
            this.logger.error(`handleFilledBuy: ${e.message}`);
        }
    }

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
            if (options.hasOwnProperty("price")) {
                options.price = Calc.roundToTickSize(options.price, exchangeInfo[options.symbol].tickSize);
            }
            options.quantity = Calc.roundToStepSize(options.quantity, exchangeInfo[options.symbol].stepSize);
            this.logger.info(
                `Placing ${options.symbol} "${options.side}" P:${options.price} | Q: ${options.quantity} | T: ${Calc.mul(
                    options.price,
                    options.quantity
                )}`
            );
            let order = await this.client.order(options);
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
            let tickSize = exchangeInfo[eventData.symbol];
            let increaseAmount = Calc.mul(tickSize, this.strategy.numTickIncrease);
            let sellPrice = Calc.add(increaseAmount, eventData.price);

            this.placeOrder({
                symbol: eventData.symbol,
                price: sellPrice,
                quantity: eventData.quantity,
                type: "LIMIT",
                side: "SELL",
            });
        } catch (e) {
            this.logger.error(
                `placeLimitSellOrder: ${e.message}. Tried to place an ${eventData.symbol} order. increaseAmount: ${increaseAmount} | sellPrice: ${sellPrice}`
            );
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

    getPairType(symbol) {
        let isFiat = symbol.slice(symbol.length - 4, symbol.length - 1) === "USD";
        let sliceLength = isFiat ? 4 : 3;
        return symbol.slice(symbol.length - sliceLength, symbol.length);
    }
}
