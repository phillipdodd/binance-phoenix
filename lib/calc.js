const math = require('mathjs');
const BaseLogger = require('./BaseLogger.js');
const logger = new BaseLogger('calc').init();
const Config = require('../data/Config.js');
/* Config */

const toFixedValue = Config.Calc.toFixedValue;

/* Test Execution */

// logger.debug(math.bignumber("0.01000100").lessThanOrEqualTo("0.00000101"))

// const decimal = "0.0000123";
// const percentage = "1.007";

// var increase = increaseByPercentage(decimal, percentage);
// var decrease = decreaseByPercentage(increase, percentage); 
// add(decimal, decimal);
// sub(decimal, decimal);

// logger.info(sum(decimal, decimal, decimal, decimal));

module.exports = class Calc {
    static add(x, y) {
        try {
            [x, y] = this.convertToBigNumbers(x, y);
            let result = x.add(y).toFixed(toFixedValue).valueOf();
            // logger.debug(`Adding ${x.valueOf()} to ${y.valueOf()} for a result of ${result}`);
            return result;
        } catch (error) {
            logger.error(error);
            throw error;
        }
    }

    static sub(x, y) {
        try {
            [x, y] = this.convertToBigNumbers(x, y);
            let result = x.sub(y).toFixed(toFixedValue).valueOf();
            // logger.debug(`Subtract ${x.valueOf()} to ${y.valueOf()} for a result of ${result}`);
            return result;
        } catch (error) {
            logger.error(error);
            throw error;
        }
    }

    static mul(x, y) {
        try {
            [x, y] = this.convertToBigNumbers(x, y);
            let result = x.mul(y).toFixed(toFixedValue).valueOf();
            return result;
        } catch (error) {
            logger.error(error);
            throw error;
        }
    }

    static divBy(x, y) {
        try {
            [x, y] = this.convertToBigNumbers(x, y);
            let result = x.dividedBy(y).toFixed(toFixedValue).valueOf();
            return result;
        } catch (error) {
            logger.error(error);
        }
    }
    static sum(...decimals) {
        try {
            return this.convertToBigNumbers(...decimals)
                .reduce((previous, current) => {
                    return previous.add(current);
                })
                .toFixed(8)
                .valueOf();
        } catch (error) {
            logger.error(error);
            throw error;
        }
    }

    static getDifferenceBetween(x, y) {
        try {
            return math.abs(this.sub(x, y));
        } catch (error) {
            logger.error(error);
            throw error;
        }
    }

    static increaseByPercentage(decimal, percentage) {
        try {
            [decimal, percentage] = this.convertToBigNumbers(decimal, percentage);
            let result = decimal.mul(percentage).toFixed(toFixedValue).valueOf();
            // logger.debug(`Increase value of ${decimal.valueOf()} by a percentage of ${percentage.valueOf()}. Resulting value: ${result}`);
            return result;
        } catch (error) {
            logger.error(error);
            throw error;
        }
    }

    static decreaseByPercentage(decimal, percentage) {
        try {
            [decimal, percentage] = this.convertToBigNumbers(decimal, percentage);
            let result = decimal.dividedBy(percentage).toFixed(toFixedValue).valueOf();
            logger.debug(
                `Decrease value of ${decimal.valueOf()} by a percentage of ${percentage.valueOf()}. Resulting value: ${result}`
            );
            return result;
        } catch (error) {
            logger.error(error);
            throw error;
        }
    }

    static roundToTickSize(decimal, tickSize) {
        try {
            [decimal, tickSize] = this.convertToBigNumbers(decimal, tickSize);
            return decimal.sub(decimal.mod(tickSize)).valueOf();
        } catch (error) {
            logger.error(error);
        }
    }

    static roundToStepSize(decimal, stepSize) {
        try {
            [decimal, stepSize] = this.convertToBigNumbers(decimal, stepSize);
            return decimal.toFixed(Math.abs(stepSize.e));
        } catch (error) {
            logger.error(error);
        }
    }

    static lessThanOrEqualTo(x, y) {
        [x, y] = this.convertToBigNumbers(x, y);
        return x.lessThanOrEqualTo(y);
    }

    static convertToBigNumbers(...args) {
        try {
            return [...args].map((value) => {
                return math.bignumber(value);
            });
        } catch (error) {
            logger.error(error);
            throw error;
        }
    }
}
