/**
 * could ignore certain volume outliers to be more/less aggressive
 */
// let orderBook = JSON.parse(fs.readFileSync('./exchangeInfo.json'));
// let asks = orderBook.asks;

// let asksQuantities = asks
//     .map(val => +val.quantity)
//     // .sort((a, b) => a - b);
// let [q1, q2] = math.quantileSeq(asksQuantities, 2, false);

// let filteredAsks = asks.filter(val => val.quantity > q1);
// console.log(asksQuantities)

// should i ignore prices of orders at a volume below a certain quantile?
// less ignoring = more aggressive strategy