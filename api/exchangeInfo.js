let exchangeInfo;

const init = async (client) => {
    exchangeInfo = await getSimplifiedExchangeInfo(client).catch(err => { throw err; });
    return true;
}

const getSimplifiedExchangeInfo = async (client) => {
    let exchangeInfo = await client.exchangeInfo().catch(err => { throw err; });

    let simplifiedExchangeInfo = {};
    exchangeInfo.symbols.forEach((value) => {
        simplifiedExchangeInfo[value.symbol] = simplifyExchangeInfo(value);
    });

    return simplifiedExchangeInfo;
}

const simplifyExchangeInfo = value => {
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

const getFilterValue = (value, filterName) => {
    return value.filters.find((filter) => {
        return filter.hasOwnProperty(filterName);
    })[filterName];
}

const isValidSymbol = (symbol) => !!exchangeInfo[symbol];

const getTickSize = (symbol) => {
    try {
        if (!isValidSymbol(symbol)) {
            throw new Error(`Input error: ${symbol} is an invalid symbol`);
        }
        return exchangeInfo[symbol].tickSize;
    } catch (err) {
        throw err;
    }
};

module.exports = { init, isValidSymbol, getTickSize };