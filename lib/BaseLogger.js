
const path = require('path');
// const fileUrlToPath = require('url').fileURLToPath;
// const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { createLogger, format, transports } = require('winston');
const { combine, colorize, json, timestamp, label, printf } = format;

const myFormat = printf(info => {
    return `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`;
});

const infoFileName = path.join(__dirname, "../logs", `combined.log`);
// const errorFileName = path.join(__dirname, "logs", `${new Date().toLocaleDateString()}.error.log`);

module.exports = class BaseLogger {
    constructor(labelName) {
        this.labelName = labelName;
    }
    init() {
        return createLogger({
            // Leaving this on the top level in case I define more File transports in the future
            format: combine(json(), label({ label: this.labelName }), timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), myFormat),
            transports: [
                new transports.File({
                    level: "debug",
                    filename: infoFileName,
                    handleExceptions: "false",
                    json: true,
                    maxsize: 5242880, //5MB
                    maxFiles: 5,
                    colorize: false,
                }),
                new transports.Console({
                    level: "debug",
                    handleExceptions: true,
                    json: false,
                    colorize: true,
                    format: combine(colorize(), label({ label: this.labelName }), timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), myFormat),
                }),
            ],
            exitOnError: false,
        }); 
    }
}