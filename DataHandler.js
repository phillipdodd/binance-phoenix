import nedbpkg from "nedb-promises";
const Datastore = nedbpkg;
import { BaseLogger } from "./lib/BaseLogger.js";

export class DataHandler {
    constructor(user) {
        try {
            console.log(`./datastores/${user}OrderEventData.db`);
            this.datastore = Datastore.create(`./datastores/${user}OrderEventData.db`);
            console.log(this.datastore);
            this.logger = new BaseLogger(`datahandler (${user})`);
        } catch (e) {
            console.error(e);
        }
    }
    insert(eventData) {
        try {

        } catch (e) {
            this.logger.error(`insert: ${e.message}`);
        }
        return this.datastore.insert(eventData);
    }
}