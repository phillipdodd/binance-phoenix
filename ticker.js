module.exports = binanceInstance => new Ticker(binanceInstance);

class Ticker {
    
    constructor(binanceInstance) {
        this.binanceInstance = binanceInstance;
        this.data = {};
    }

    setWebsocket(symbolArray) {
        if (this.websocket) this.websocket();
        this.websocket = this.binanceInstance.ws.ticker(symbolArray, (tickerData) => {
            this.data[tickerData.symbol] = tickerData;
        });
    }
}