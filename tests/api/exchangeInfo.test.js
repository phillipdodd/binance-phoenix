const exchangeInfo = require('../../api/exchangeInfo.js');
const Instance = require('../../instance.js');
const { users } = require('../../data/constants.js');

const { client } = new Instance(users.phil);
const symbol = "BTCUSD";

describe('success', () => {
    it('can initialize', async () => {
        const didInit = await exchangeInfo.init(client).catch((err) => {
            throw err;
        });
        
        expect(didInit).toBe(true);
    });

    it('can check a valid symbol', () => {
        expect(exchangeInfo.isValidSymbol(symbol)).toBe(true);
    });

    it('can get tick size', () => {
        expect(exchangeInfo.getTickSize(symbol)).toBeDefined();
    });
});

describe('fail', () => {
    it('rejects invalid symbols', () => {
        expect(() => {
            exchangeInfo.getTickSize("");
        }).toThrow();
    })
});