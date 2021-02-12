require("dotenv").config();
const Binance = require("us-binance-api-node").default;
const fs = require("fs");
const logger = require("./lib/myWinston")("index");
const calc = require("./lib/calc");
const exchangeInfo = require("./exchangeInfo.json");
const instance = require('./instance');

// Object.prototype.renameProp = function (currentPropName, newPropName) {
//     this[newPropName] = this[currentPropName];
//     delete this[currentPropName];
// };

//* Authenticated client, can make signed calls
const clientTom = instance({
    user: "TOM",
    buyQuantity: 20,
    percentage: 1.003,
});
// const Ticker = require("./ticker")(clientPhil);

clientTom.init();

// async function getExchangeInfo() {
//     try {
//         let exchangeInfo = await client.exchangeInfo();

//         if (!exchangeInfo.symbols) throw new Error("Returned exchangeInfo contained no symbols array!");

//         let simplifiedExchangeInfo = {};
//         let getFilterValue = (value, filterName) => {
//             return value.filters.find((filter) => {
//                 return filter.hasOwnProperty(filterName);
//             })[filterName];
//         };

//         exchangeInfo.symbols.forEach((v) => {
//             simplifiedExchangeInfo[v.symbol] = {
//                 baseAsset: v.baseAsset,
//                 quoteAsset: v.quoteAsset,
//                 quotePrecision: v.quotePrecision,
//                 status: v.status,
//                 tickSize: getFilterValue(v, "tickSize"),
//                 stepSize: getFilterValue(v, "stepSize"),
//                 minNotional: getFilterValue(v, "minNotional"),
//             };
//         });

//         return simplifiedExchangeInfo;

//     } catch (e) {
//         logger.error(e);
//     }
// }

// async function writeExchangeInfoToFile() {
//     let exchangeInfo = await getExchangeInfo();
//     fs.writeFileSync(`./exchangeInfo.json`, JSON.stringify(exchangeInfo));
// }



/**
 *
 * @param {string} side BUY or SELL
 * @param {string} symbol trading pair symbol, ex DOGEUSD
 * @param {number} quantity
 * @param {number} price
 */
async function placeLimitOrder(side, symbol, quantity, price) {
    try {
        // Check if valid notional
        let notional = calc.mul(quantity, price);
        let minNotional = +exchangeInfo[symbol].minNotional;
        if (notional < minNotional)
            throw new Error(`${notional} is not above the minNotional of ${minNotional} for pair ${symbol}`);

        return await client.order({
            side: side,
            type: "LIMIT",
            symbol: symbol,
            quantity: quantity,
            price: price,
        });
    } catch (e) {
        logger.error(e);
        console.log(e);
    }
}

async function placeBuyOrder(symbol, doCalcQuantity) {
    try {
        const orderQuantityValues = {
            DOGEUSD: 1000,
        };

        let tickerValues = await getLatestBookTickerValues(symbol);
        let calcPrice = calc.add(tickerValues.bid.price, exchangeInfo[symbol].tickSize);
        let precisePrice = Number(calcPrice).toFixed(exchangeInfo[symbol].quotePrecision);
        let quantity = orderQuantityValues[symbol];

        if (doCalcQuantity) {
            let calcQuantity = calc.roundToStepSize(calc.divBy(quantity, bidPrice), exchangeInfo[symbol].stepSize);
            quantity = calcQuantity;
            logger.debug(`doCalcQuantity true: replacing ${quantity} with ${calcQuantity}`);
        }

        logger.debug(`Placing ${symbol} BUY - P: ${precisePrice} Q:${quantity} T:${calc.mul(precisePrice, quantity)}`);

        let buyOrder = await placeLimitOrder("BUY", symbol, quantity, precisePrice);
        return buyOrder ? buyOrder : undefined;
    } catch (e) {
        logger.error(e);
        console.error(e);
    }
}

async function placeSellOrder(eventData) {
    const increasePercentage = 1.005;

    let increasedPrice = calc.increaseByPercentage(eventData.price, increasePercentage);
    let tickSize = exchangeInfo[eventData.symbol].tickSize;
    let roundedPrice = calc.roundToTickSize(increasedPrice, tickSize);
    let precisePrice = Number(roundedPrice).toFixed(exchangeInfo[eventData.symbol].quotePrecision);

    logger.info(
        `Placing ${eventData.symbol} SELL - P: ${precisePrice} Q: ${eventData.quantity} T:${calc.mul(
            precisePrice,
            eventData.quantity
        )}`
    );

    let orderResponse = await placeLimitOrder("SELL", eventData.symbol, eventData.quantity, precisePrice);

    return orderResponse;
}








// Ticker.setWebsocket(["DOGEUSD"]);

// //* market/buy
// client.ws.user((eventData) => {

//     let symbol = eventData.symbol;
//     let quantity = 1000;
//     let percentage = 1.003;

//     if (!eventData.eventType === "executionReport") return;
    
//     if (eventData.side === "BUY" && eventData.orderStatus === "FILLED") {
//         logger.info(`Market buy order filled ${eventData.priceLastTrade}`);
//         let calcPrice = calc.increaseByPercentage(eventData.priceLastTrade, percentage);
//         let roundedPrice = calc.roundToTickSize(calcPrice, exchangeInfo[symbol].tickSize);
//         client.order({
//             symbol: symbol,
//             quantity: quantity,
//             type: "LIMIT",
//             side: "SELL",
//             price: roundedPrice,
//         });
//         logger.info(`Placing sell order. P:${roundedPrice} | Q: ${quantity}`);
//     }

//     if (eventData.side === "SELL" && eventData.orderStatus === "FILLED") {
//         client.order({
//             symbol: symbol,
//             quantity: quantity,
//             type: "MARKET",
//             side: "BUY",
//         });
//     }
// })



