const Datastore = require('nedb-promises');
const db = new Datastore({ filename: "../datastores/TOMOrderEventData.db", autoload: true });
const fs = require('fs');
const d3 = require('d3');

(async () => {
    try {
        let executionReports = await db.find({ "eventType": "executionReport" }).catch(err => {throw err});
        console.log(executionReports);
        executionReports = executionReports.map(report => {
            let formattedReport = formatExecutionReport(report);
            return formattedReport;
        });
        fs.writeFileSync('./executionReports.csv', d3.csvFormat(executionReports));
    
        // let orderReports = await db.find({ "eventType": { $exists: false } });
        // fs.writeFileSync('./orderReports.csv', d3.csvFormat(orderReports));
    } catch (e) {
        console.error(e)
    }
})()

function formatExecutionReport(executionReport) {
    const formattedReport = { ...executionReport };
    const removeProperties = [
        'timeInForce',
        'executionType',
        'stopPrice',
        'icebergQuantity',
        'orderStatus',
        'orderRejectReason',
        'isOrderWorking',
        'originalClientOrderId',
    ]
    removeProperties.forEach(prop => delete formattedReport[prop]);

    let eventDate = new Date(formattedReport.eventTime);
    let orderDate = new Date(formattedReport.orderTime);
    let creationDate = new Date(formattedReport.creationTime);


    formattedReport.eventTime = eventDate.toLocaleTimeString();
    formattedReport.orderTime = orderDate.toLocaleTimeString();
    formattedReport.creationTime = creationDate.toLocaleTimeString();

    return formattedReport;
}