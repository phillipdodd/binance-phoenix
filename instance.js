// const Binance = require("us-binance-api-node").default;
import Binance from "us-binance-api-node";
import fs from "fs";
import { Calc } from "./lib/Calc.js";
import { BaseLogger } from "./lib/BaseLogger.js";

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

        //todo does this data need to live somewhere else?
        this.filledSellOrders = [];

        this.logger = new BaseLogger(`instance_${user}`).init();

        this.startingBTC = 0.0025;
        this.targetBTC = 0.00255;
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
            };

            let handleFilledLimitSell = (eventData) => {
                try {
                    this.filledSellOrders.push(eventData);

                    //* Using market buy here instead to avoid things stalling out and never filling a buy order
                    this.placeLimitBuyOrder(eventData);
                    // this.placeMarketBuyOrder(eventData);
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
        // this.placeLimitBuyOrder({symbol: "ADABTC"});
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

    async placeLimitBuyOrder(eventData) {
        try {
            //* temporarily using a class variable for startingBTC
            // let startingBTC = this.strategy[eventData.symbol].startingBTC;
            let marketValue = await this.getBestBidPrice(eventData.symbol);
            let buyQuantity = Calc.divBy(this.startingBTC, marketValue);

            this.placeOrder({
                symbol: eventData.symbol,
                price: marketValue,
                quantity: buyQuantity,
                type: "LIMIT",
                side: "BUY",
            });
        } catch (e) {
            this.logger.error(`placeLimitBuyOrder: ${e.message}`);
        }
    }

    async placeMarketBuyOrder(eventData) {
        try {
            //* temporarily using a class variable for startingBTC
            // let startingBTC = this.strategy[eventData.symbol].startingBTC;
            let marketValue = await this.getBestBidPrice(eventData.symbol);
            let buyQuantity = Calc.divBy(this.startingBTC, marketValue);

            this.placeOrder({
                symbol: eventData.symbol,
                quantity: buyQuantity,
                type: "MARKET",
                side: "BUY",
            });
        } catch (e) {
            this.logger.error(`placeMarketBuyOrder: ${e.message}`);
        }
    }

    async placeLimitSellOrder(eventData) {
        try {
            //* temporarily using a class variable for targetBTC
            // let targetBTC = this.strategy[eventData.symbol].targetBTC;
            let sellPrice = Calc.divBy(this.targetBTC, eventData.quantity);

            this.placeOrder({
                symbol: eventData.symbol,
                price: sellPrice,
                quantity: eventData.quantity,
                type: "LIMIT",
                side: "SELL",
            });
        } catch (e) {
            this.logger.error(`placeLimitSellOrder: ${e.message}`);
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
}
