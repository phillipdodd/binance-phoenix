    async function recordProfitAndFee(eventData) {
        try {
                                let boughtForPrice =
                                    eventData.price -
                                    calc.roundToTickSize(
                                        calc.divBy(eventData.price, this.increasePercentage),
                                        exchangeInfo[eventData.symbol].tickSize
                                    );
                                let boughtForTotal = calc.mul(boughtForPrice, quantity);
                                let soldForTotal = calc.mul(eventData.price, quantity);
                                let totalProfit = soldForTotal - boughtForTotal;
                                this.profit.BTC = calc.add(this.profit.BTC, totalProfit);

                                if (!this.fees[eventData.commissionAsset]) this.fees[eventData.commissionAsset] = 0;
                                this.fees[eventData.commissionAsset] = calc.add(
                                    this.fees[eventData.commissionAsset],
                                    eventData.commission
                                );

                                this.logger.info(`profit: ${this.profit.BTC} || fees: ${this.fees[eventData.commissionAsset]}`);

        } catch (e) {
            this.logger.error(`recordProfitAndFee: ${e.message}`)
        }
    }