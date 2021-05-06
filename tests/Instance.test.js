const Instance = require('../Instance.js');
const Users = require('../data/Users.js');
const { tomStrategy } = require("../data/Strategies.js");

const instance = new Instance(Users.Tom, tomStrategy);

it('Can successfully create an instance', () => {
    expect(instance).toBeDefined();
    expect(instance).toHaveProperty('client');
});

it('Can successfully open/close a user websocket', async () => {
    const clean = await instance.client.ws.user((eventData) => { });
    expect(clean).toBeDefined();
    clean();
});



