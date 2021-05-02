

class Ticker {
    
    constructor(binanceInstance) {
        this.binanceInstance = binanceInstance.client;
        this.data = {};
    }
    
    async setWebsocket(symbolArray) {
        try {
            if (this.websocket) this.websocket();
            this.websocket = this.binanceInstance.ws.ticker(symbolArray, (tickerData) => {
                this.data[tickerData.symbol] = tickerData;
            });
        } catch (e) {
            console.error(e.message);
        }
    }
}
module.exports = Ticker;