async function handleFilledBuyOrder(eventData) {
    try {
        if (!orderCache.hasOwnProperty(eventData.orderId)) {
            logger.debug(`Creating new generator for Order: ${eventData.orderId}.`);
            orderCache[eventData.orderId] = createOrderGeneratorFn(eventData.price);
        }

        let sellOrder = await placeSellOrder(eventData);
        orderCache.renameProp(eventData.orderId, sellOrder.orderId);
    } catch (e) {
        logger.error(e);
        console.error(e);
    }
}

async function handleFilledSellOrder(eventData) {
    try {
        if (!orderCache[eventData.orderId]) return;

        logger.info(`Running Gen - ${eventData.symbol} Order ${eventData.orderId} with price ${eventData.price}`);
        if (runGenerator(orderCache[eventData.orderId], eventData.price)) {
            logger.info(`Generator returned true. Re-posting.`);
            let buyOrder = await placeBuyOrder(eventData.symbol);
            logger.debug(`buyOrder is ${buyOrder}. If 'undefined', line 180 could be an || statement with two awaits`);
            if (!buyOrder) {
                logger.debug(`buyOrder was undefined, trying again with doCalculateQuantity...`);
                buyOrder = await placeBuyOrder(eventData.symbol, true);
            }

            logger.debug(`Placed new buy order. Renaming order ${eventData.orderId} to ${buyOrder.orderId}`);
            orderCache.renameProp(eventData.orderId, buyOrder.orderId);
        } else {
            logger.debug(`Generator for order ${eventData.orderId} is done. Not re-posting.`);
        }
    } catch (e) {
        logger.error(e);
        console.error(e);
    }
}

function createOrderGeneratorFn(startingPrice) {
    try {
        let generator = function* () {
            let limit = calc.increaseByPercentage(startingPrice, 1.007);
            let isInPriceRange = (price) => calc.lessThanOrEqualTo(price, limit);
            while (isInPriceRange(yield)) yield true;
        };
        let iterator = generator();
        iterator.next();
        return iterator;
    } catch (e) {
        console.error(e);
    }
}

function runGenerator(generator, price) {
    if (!generator) {
        logger.error("No generator found, returning");
        return;
    }

    let result = generator.next(price).value;
    generator.next();
    return result;
}
