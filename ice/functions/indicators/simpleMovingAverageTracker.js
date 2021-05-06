const tulind = require('tulind');

class SimpleMovingAverageTracker {

    /**
     * 
     * @param {string} symbol 
     * @param {string} candleInterval 
     * @param {number} periodNum 
     * @param {object} binanceClient 
     */
    constructor(symbol, candleInterval, periodNum, binanceClient) {
        this.symbol = symbol;
        this.candleInterval = candleInterval || "5m";
        this.periodNum = [periodNum] || [7];
        this.binanceClient = binanceClient;

        this.data = [];
        this.sma = 0.00;

        this.logger = require('../lib/myWinston')(`SimpleMovingAverageTracker (${symbol})`);
    }

    init() {
        try {
            this.websocket = this.binanceClient.ws.candles(
                this.symbol,
                this.candleInterval,
                (candle) => {
                    try {
                        if (candle.isFinal) {
                            //* Data order needs to be oldest to newest when passed to sma()
                            //! NOTE: Using closePrice. Seems to be the most common choice when using SMA
                            this.data.push(candle.close);
                            
                            // if (this.data.length > this.periodNum[0]) {
                            //     this.data.shift();
                            // }
                            //* Wait until enough data is in the array
                            if (this.data.length >= this.periodNum[0]) {
                                this.sma = this.calculateSMA();
                            }
                        }
                    } catch (e) {
                        this.logger.error(`candleHandler: ${e.message}`);
                    }
                }
            );

            //* Allows init() to be run using await for when SMA values are available
            return new Promise(resolve => { 
                let checkLengthInterval = setInterval(() => {
                    if (this.data.length >= this.periodNum[0]) {
                        clearInterval(checkLengthInterval);
                        resolve();
                    }
                }, 1000);
            });
            
        } catch (e) {
            this.logger.error(e.message);            
        }
    }

    calculateSMA() {
        try {
            let latestSma;
            let handleResults = (err, results) => {
                if (err) logger.error(err.message);
                let smaArray = results[0];
                latestSma = smaArray[smaArray.length - 1];
            }

            tulind.indicators.sma.indicator(
                [this.data],
                this.periodNum,
                handleResults
            );

            return latestSma;
        } catch (e) {
            this.logger.error(`calculateSMA: ${e.message}`);
        }
    }
}

module.exports = SimpleMovingAverageTracker;