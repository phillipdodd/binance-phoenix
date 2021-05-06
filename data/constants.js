module.exports.config = {
    Calc: {
        toFixedValue: 8
    },
    resetTime: 60_000
}

module.exports.users = {
    phil: "PHIL",
    tom: "TOM",
};

module.exports.strategies = {
    TOM: {
        orderLimit: 999,
        startingBTC: 0.00125,
        startingUSD: 25,
        numTickIncrease: 3,
        initPairs: ["ETHUSD", "DOGEUSD", "ADAUSD", "BTCUSD", "MATICUSD", "VETUSD", "ONEUSD", "SOLUSD"],
    },
    PHIL: {
        orderLimit: 999,
        startingUSD: 1000,
        numTickIncrease: 3,
        initPairs: ["DOGEUSD"],
    },
};