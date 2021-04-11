const DataHandler = require('../lib/DataHandler.js');
const testDataHandler = new DataHandler('test');

class MockExecutionReportEventData {
    constructor(side = "BUY") {
        this.side = side;
        this.orderId = '12345';
        this.orderType = 'MARKET'
        this.orderStatus = 'FILLED';
        this.price = 0.01234;
        this.quantity = 200;
        this.symbol = "DOGEUSD";

    }
}

const mockEventData = new MockExecutionReportEventData();

it('Can insert new order event data', async () => {
    const newDoc = await testDataHandler.insert(mockEventData);
    expect(newDoc).toBeDefined();
});

it('Can query a document', async () => {
    const queriedDoc = await testDataHandler.find({ orderId: '12345' });
    expect(queriedDoc).toBeDefined();
});

it('Can remove a document', async () => {
    const response = await testDataHandler.remove({ orderId: "12345" }, { multi: true });
    expect(response).toBeGreaterThan(0);
});