require('dotenv').config();
const Instance = require("./Instance.js");
const Users = require("./data/Users.js");
const { tomStrategy, philStrategy } = require("./data/Strategies.js");
const SimpleMovingAverageTracker = require("./indicators/simpleMovingAverageTracker");

const instanceTom = new Instance(Users.Tom, tomStrategy);
instanceTom.init();


const intervalNum = "1m";
const sma7 = new SimpleMovingAverageTracker("DOGEUSD", intervalNum, 5, instanceTom.client);

(async () => {
    await sma7.init();
    setInterval(() => {
        console.log(sma6.sma);
    }, 1000);
})();
