import { DataHandler } from "./DataHandler.js";
import fs from "fs";


export class InstanceUtility {
    constructor(instance) {
        this.client = instance.client;
        this.logger = instance.logger;
    }

    async updateExchangeInfo() {
        try {
            await this.writeExchangeInfoToFile();
            this.logger.info("exchangeInfo.json up to date.");
        } catch (e) {
            this.logger.error(`updateExchangeInfo: ${e.message}`);
        }
    }

    async getExchangeInfo() {
        try {
            let exchangeInfo = await this.client.exchangeInfo();
            
            let simplifiedExchangeInfo = {};
            exchangeInfo.symbols.forEach((value) => {
                simplifiedExchangeInfo[value.symbol] = simplifyExchangeInfo(value);
            });

            return simplifiedExchangeInfo;
        } catch (e) {
            this.logger.error(`getExchangeInfo: ${e.message}`);
        }
    }

    async writeExchangeInfoToFile() {
        let exchangeInfo = await this.getExchangeInfo();
        fs.writeFileSync(`./exchangeInfo.json`, JSON.stringify(exchangeInfo));
    }

    async getBestBidPrice(symbol) {
        const orderBook = await this.client.book({ symbol: symbol });
        return orderBook.bids[0].price;
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

function getFilterValue(value, filterName) {
    return value.filters.find((filter) => {
        return filter.hasOwnProperty(filterName);
    })[filterName];
}

function simplifyExchangeInfo(value) {
    return {
        baseAsset: value.baseAsset,
        quoteAsset: value.quoteAsset,
        quotePrecision: value.quotePrecision,
        status: value.status,
        tickSize: getFilterValue(value, "tickSize"),
        stepSize: getFilterValue(value, "stepSize"),
        minNotional: getFilterValue(value, "minNotional"),
    };
}