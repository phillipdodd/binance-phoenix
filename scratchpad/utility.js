(async () => {
    let orders = await this.client.openOrders();
    orders
        .filter((v) => v.side === "BUY")
        .forEach((v) => {
            this.client.cancelOrder({
                symbol: v.symbol,
                orderId: v.orderId,
            });
        });
})();
