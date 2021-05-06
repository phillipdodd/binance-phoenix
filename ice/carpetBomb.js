export async function carpetBomb(options) {
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