const Calc = require('../lib/calc');
const exchangeInfo = require('../exchangeInfo.json');

const percentage = 1.003;

const tickNumMap = {
    4: 11,
    8: 3
}

function getNumTicks(quotePrecision){
    if (quotePrecision === 8) return 3;
    if (quotePrecision === 4) return 11;
}

const price = 0.043185;
const symbol = "ETHBTC"

console.log(symbol)
console.log(price)
console.log(Calc.increaseByPercentage(percentage, price));
console.log(
    Calc.add(
        Calc.mul(
            exchangeInfo[symbol].tickSize,
            tickNumMap[exchangeInfo[symbol].quotePrecision]
        ),
        price
    )
);

// let doge_q = 45;
// let doge_p = .4498;
// let doge_com = 0.041248;
// 0.041248
// 0.041241;