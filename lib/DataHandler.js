const Datastore = require("nedb-promises");

class DataHandler {
    constructor(user) {
        this.datastore = Datastore.create(`./datastores/${user}OrderEventData.db`);
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

    update(query, updateQuery, options = {}) {
        return this.datastore.update(query, updateQuery, options).catch((err) => console.error(err));
    }
};

module.exports = DataHandler;