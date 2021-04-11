const Datastore = require("nedb-promises");
const BaseLogger = require('./BaseLogger.js');

module.exports = class DataHandler {
    constructor(user) {
        this.datastore = Datastore.create(`./datastores/${user}OrderEventData.db`);
        this.logger = new BaseLogger(`datahandler (${user})`);
    }

    insert(eventData, options = {}) {
        return this.datastore.insert(eventData, options).catch((err) => console.error(err));
    }

    find(query, options = {}) {
        return this.datastore.find(query, options).catch((err) => console.error(err));
    }

    remove(query, options = {}) {
        return this.datastore.remove(query, options).catch((err) => console.error(err));
    }
};