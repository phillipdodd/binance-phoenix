require("dotenv").config();
const instance = require('./instance');

const clientTom = instance({
    apiKey: process.env.API_KEY_TOM,
    apiSecret: process.env.API_SECRET_TOM,
    strategy: require('./strategies/tomStrategy.json')
});
clientTom.init();

// const clientPhil = instance({
//     apiKey: process.env.API_KEY_PHIL,
//     apiSecret: process.env.API_SECRET_PHIL,
//     strategy: require('./strategies/philStrategy.json')
// });
// clientPhil.init();
