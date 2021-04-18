const Datastore = require("nedb-promises");
const BaseLogger = require("./BaseLogger.js");
const logger = new BaseLogger("DataHandler").init();

class DataHandler {
    constructor(user) {
        this.datastore = Datastore.create(`./datastores/${user}OrderEventData.db`);
    }

    insert(eventData, options = {}) {
        logger.debug(`Inserting orderId: ${eventData.orderId}`)
        return this.datastore.insert(eventData, options).catch((err) => { throw err; });
    }

    find(query, options = {}) {
        return this.datastore.find(query, options).catch((err) => { throw err; });
    }

    remove(query, options = {}) {
        return this.datastore.remove(query, options).catch((err) => { throw err; });
    }

    update(query, updateQuery, options = {}) {
        return this.datastore.update(query, updateQuery, options).catch((err) => { throw err; });
    }
};

module.exports = DataHandler;