const Instance = require("./Instance.js");
const Users = require("./data/Users.js");
// const SimpleMovingAverageTracker = require('./indicators/simpleMovingAverageTracker');

const instanceTom = new Instance(Users.Tom);
instanceTom.init();

// const instancePhil = new Instance(
//     Users.Phil,
//     philStrategy
// );
// instancePhil.init();

// const instancePhil = new Instance(
//     process.env.API_KEY_PHIL,
//     process.env.API_SECRET_PHIL,
//     Users.Phil,
//     tomStrategy
// );
// instancePhil.init();

// const sma7 = new SimpleMovingAverageTracker("DOGEUSD", "1m", 5, instanceTom.client);
// (async () => { 
//     await sma7.init();
//     setInterval(() => {
//         console.log(sma7.sma);
//     }, 1000);
// })()

// setInterval(() => {
//     console.log(sma7.sma);
// }, 1000);

// const Ticker = require('./ticker');
// const t = new Ticker(clientTom);
// (async () => {
//     await t.setWebsocket(["DOGEUSD"]);
//     setInterval(() => {
//         console.log(t.data);
//     }, 5000);
// })()