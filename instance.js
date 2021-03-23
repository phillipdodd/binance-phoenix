// const Binance = require("us-binance-api-node").default;
import Binance from "us-binance-api-node";

import { Calc } from "./lib/Calc.js";
import { BaseLogger } from "./lib/BaseLogger.js";

import { InstanceUtility } from "./lib/InstanceUtility.js";

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
        
        this.utility = new InstanceUtility(this);
    }

    async init() {
        try {
            await this.utility.updateExchangeInfo();
            this.websockets.user = this.client.ws.user((eventData) => {
                try {
                    if (eventData.orderStatus === "FILLED") {
                        this.handleOrderEvent(eventData);
                    }
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
        await this.utility.cancelAllOpenBuyOrders();
        //todo replace with db
        fs.writeFileSync(`./filledSellOrders.json`, JSON.stringify(this.filledSellOrders));
    }

    //todo handler manager
    handleOrderEvent(eventData) {
        try {
            if (eventData.side === "BUY")  this.handleFilledBuy(eventData);
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

    //todo tick/step rounds need to happen in a more obvious place. this is a misleading function
    /**
     * @description wrapper that ensures price and quantity are rounded to tick/step sizes
     * @param {*} options
     */
    async placeOrder(options) {
        try {
            let correctedOptions = correctTickAndStep(options);
            let orderResponse = await this.client.order(correctedOptions);

            let price = correctedOptions.price || orderResponse.fills[0].price;
            this.logger.info(
                `Placing ${orderResponse.symbol} "${orderResponse.side}" P:${price} | Q: ${orderResponse.origQty} | T: ${Calc.mul(price, orderResponse.origQty)}`
            );
            this.orderDataHandler.insert(orderResponse);

            return orderResponse;
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