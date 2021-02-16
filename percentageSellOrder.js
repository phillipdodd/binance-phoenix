    async function placeLimitSellOrder(eventData) {
        try {
            //* Defaults to 3% if no percentage value is included in strategy file
            let percentage = this.strategy[eventData.symbol].percentage || this.percentage;
            let increasedPrice = calc.increaseByPercentage(eventData.priceLastTrade, percentage);

            this.logger.info(`Placing ${eventData.symbol} "SELL" P:${increasedPrice} | Q: ${eventData.quantity}`);

            let order = await this.placeOrder({
                symbol: eventData.symbol,
                quantity: eventData.quantity,
                type: "LIMIT",
                side: "SELL",
                price: increasedPrice,
            });

            return order;
        } catch (e) {
            this.logger.error(`placeLimitOrder: ${e.message}`);
        }
    }