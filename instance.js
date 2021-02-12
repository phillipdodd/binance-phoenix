require("dotenv").config();

const Binance = require("us-binance-api-node").default;
const fs = require("fs");
const calc = require("./lib/calc");
const exchangeInfo = require("./exchangeInfo.json");

class Instance {
    /**
     * @param {string} options.user
     * @param {number} options.percentage - percentage to add/sub from market value
     * @param {number} options.buyQuantity
     */
    constructor(options) {
        this.client = Binance({
            apiKey: process.env[`API_KEY_${options.user}`],
            apiSecret: process.env[`API_SECRET_${options.user}`],
            getTime: Date.now,
        });

        this.percentage = options.percentage;
        this.buyQuantity = options.buyQuantity;

        this.logger = require("./lib/myWinston")(`instance_${options.user}`);
    }

    async init() {
        this.client.ws.user((eventData) => {
            if (eventData.side === "BUY" && eventData.orderStatus === "FILLED") {
                this.logger.info(`Market buy order filled ${eventData.priceLastTrade}`);
                this.placeLimitSellOrder(eventData);
            }
            if (eventData.side === "SELL" && eventData.orderStatus === "FILLED") {
                this.client.order({
                    symbol: eventData.symbol,
                    quantity: this.buyQuantity,
                    type: "MARKET",
                    side: "BUY",
                });
            }
        });

        // console.log(await this.client.accountInfo())

        // let book = await this.client.book({ symbol: "ADABTC" });
        // let bestBid = book.bids[0].price;
        // let bestBid3 = calc.roundToTickSize(calc.decreaseByPercentage(bestBid, 1.003), exchangeInfo["ADABTC"].tickSize);
        // let bestBid6 = calc.roundToTickSize(calc.decreaseByPercentage(bestBid, 1.006), exchangeInfo["ADABTC"].tickSize);
        // let bestBid9 = calc.roundToTickSize(calc.decreaseByPercentage(bestBid, 1.009), exchangeInfo["ADABTC"].tickSize);
        // let bestBid12 = calc.roundToTickSize(calc.decreaseByPercentage(bestBid, 1.012), exchangeInfo["ADABTC"].tickSize);

        // this.logger.info(`Placing initial orders for: ${bestBid}, ${bestBid3}, ${bestBid6}, ${bestBid9}, ${bestBid12}`);

        // this.client.order({ symbol: "ADABTC", quantity: 20, type: "LIMIT", side: "BUY", price: bestBid });
        // this.client.order({ symbol: "ADABTC", quantity: 20, type: "LIMIT", side: "BUY", price: bestBid3 });
        // this.client.order({ symbol: "ADABTC", quantity: 20, type: "LIMIT", side: "BUY", price: bestBid6 });
        // this.client.order({ symbol: "ADABTC", quantity: 20, type: "LIMIT", side: "BUY", price: bestBid9 });
        // this.client.order({ symbol: "ADABTC", quantity: 20, type: "LIMIT", side: "BUY", price: bestBid12 });

        // this.logger.info(`Instance initialized`);
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
            let order = await this.client.order(options);
            return order;
        } catch (e) {
            this.logger.error(`placeOrder: ${e.message}`);
        }
    }

    async placeLimitBuyOrder(eventData) {}
    async placeLimitSellOrder(eventData) {
        try {
            let calcPrice = calc.increaseByPercentage(eventData.priceLastTrade, this.percentage);
            this.logger.info(`Placing sell order. P:${calcPrice} | Q: ${eventData.quantity}`);
            let order = await this.placeOrder({
                symbol: eventData.symbol,
                quantity: eventData.quantity,
                type: "LIMIT",
                side: "SELL",
                price: calcPrice,
            });
            return order;
        } catch (e) {
            this.logger.error(`placeLimitOrder: ${e.message}`);
        }
    }
}

module.exports = (options) => new Instance(options);
