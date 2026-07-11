const fs = require("fs");
const path = require("path");

class Logger {

    constructor() {

        this.logsDir = path.join(process.cwd(), "logs");

        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }

        const today = new Date().toISOString().split("T")[0];

        this.logFile = path.join(this.logsDir, `${today}.log`);

    }

    write(level, message) {

        const time = new Date().toLocaleString("pl-PL");

        const line = `[${time}] [${level}] ${message}\n`;

        fs.appendFileSync(this.logFile, line);

        console.log(line.trim());

    }

    info(message) {
        this.write("INFO", message);
    }

    warning(message) {
        this.write("WARNING", message);
    }

    error(message) {
        this.write("ERROR", message);
    }

}

module.exports = Logger;