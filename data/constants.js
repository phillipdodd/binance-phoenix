const config = {
    Calc: {
        toFixedValue: 8,
    },
    resetTime: 20_000,
};

const users = {
    phil: "PHIL",
    tom: "TOM",
};

const strategies = {
    TOM: {
        orderLimit: 999,
        startingBTC: 0.00125,
        startingUSD: 25,
        numTickIncrease: 3,
        initPairs: ["DOGEUSD"],
        // initPairs: ["ETHUSD", "DOGEUSD", "ADAUSD", "BTCUSD", "MATICUSD", "VETUSD", "ONEUSD", "SOLUSD"],
    },
    PHIL: {
        orderLimit: 999,
        startingUSD: 200,
        numTickIncrease: 3,
        initPairs: ["DOGEUSD"],
    },
};

module.exports = { config, users, strategies }