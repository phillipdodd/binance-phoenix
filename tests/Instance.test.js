const Instance = require('../Instance.js');
const { users, strategies } = require('../data/constants.js');

const instance = new Instance(users.tom);

it('Can successfully create an instance', () => {
    expect(instance).toBeDefined();
    expect(instance).toHaveProperty('client');
});

it('Can successfully open/close a user websocket', async () => {
    const clean = await instance.client.ws.user((eventData) => { });
    expect(clean).toBeDefined();
    clean();
});



