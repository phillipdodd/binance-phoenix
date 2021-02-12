require("dotenv").config();
const Binance = require("us-binance-api-node").default;

//* Authenticated client, can make signed calls
const client = Binance({
    apiKey: process.env.API_KEY_PHIL,
    apiSecret: process.env.API_SECRET_PHIL,
    getTime: Date.now, //* time generator function, optional, defaults to () => Date.now()
});
