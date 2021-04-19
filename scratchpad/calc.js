const Calc = require('../lib/calc');
const exchangeInfo = require('../exchangeInfo.json');

const price = 0.00000439;
const percentage = 1.003;

console.log(Calc.increaseByPercentage(percentage, price));
console.log(Calc.add(Calc.mul(exchangeInfo["VETBTC"].tickSize, 3), price));

// VETBTC
// 0.0000044;
// 0.00000442;

// 0.00000440317;
// 0.000004390003;


// const sold   = 0.05393336;
// const bought = 0.06635729;
// console.log(
//     Calc.sub(sold, bought)
// )