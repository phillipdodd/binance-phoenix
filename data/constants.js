const config = {
    Calc: {
        toFixedValue: 8,
    },
    resetTime: 10_000,
};

const users = {
    phil: "PHIL",
    tom: "TOM",
};

const strategies = {
    TOM: {
        orderLimit: 100,
        startingBTC: 0.00125,
        startingUSD: 50,
        numTickIncrease: 3,
        // initPairs: ["DOGEUSD"],
        initPairs: [
            "ETHUSD", "DOGEUSD", "ADAUSD", "BTCUSD", "MATICUSD", "VETUSD", "ONEUSD", "SOLUSD",
            "ETHBTC", "BNBBTC", "ADABTC", "VETBTC"
        ],
    },
    PHIL: {
        orderLimit: 999,
        startingUSD: 200,
        numTickIncrease: 3,
        initPairs: ["DOGEUSD"],
    },
};

module.exports = { config, users, strategies }