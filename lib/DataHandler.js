const Datastore = require("nedb-promises");
const BaseLogger = require('./BaseLogger.js');

module.exports = class DataHandler {
    constructor(user) {
        this.datastore = Datastore.create(`./datastores/${user}OrderEventData.db`);
        this.logger = new BaseLogger(`datahandler (${user})`);
    }
    insert(eventData) {
        try {
            return this.datastore.insert(eventData);
        } catch (e) {
            this.logger.error(`insert: ${e.message}`);
        }
    }
}