const tls = require("tls");

class HomePlMailConnector {
    constructor({
        email,
        password,
        imapHost,
        imapPort = 993
    }) {
        this.email = email;
        this.password = password;
        this.imapHost = imapHost;
        this.imapPort = Number(imapPort);
    }

    escape(value) {
        return String(value)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"');
    }

    async checkInbox() {
        const socket = tls.connect({
            host: this.imapHost,
            port: this.imapPort,
            servername: this.imapHost,
            rejectUnauthorized: true
        });

        socket.setEncoding("utf8");

        let buffer = "";
        let sequence = 0;
        const waiters = new Map();

        const nextTag = () => {
            sequence += 1;
            return `A${String(sequence).padStart(4, "0")}`;
        };

        const command = (text) => new Promise((resolve, reject) => {
            const tag = nextTag();
            const timeout = setTimeout(() => {
                waiters.delete(tag);
                reject(new Error("Timeout połączenia IMAP."));
            }, 15000);

            waiters.set(tag, {
                resolve,
                reject,
                timeout,
                lines: []
            });

            socket.write(`${tag} ${text}\r\n`);
        });

        socket.on("data", (chunk) => {
            buffer += chunk;

            let index;

            while ((index = buffer.indexOf("\r\n")) !== -1) {
                const line = buffer.slice(0, index);
                buffer = buffer.slice(index + 2);

                for (const [tag, waiter] of waiters.entries()) {
                    waiter.lines.push(line);

                    if (line.startsWith(`${tag} `)) {
                        clearTimeout(waiter.timeout);
                        waiters.delete(tag);

                        if (line.includes(" OK")) {
                            waiter.resolve(waiter.lines);
                        }
                        else {
                            waiter.reject(
                                new Error(
                                    `IMAP: ${waiter.lines.join(" | ")}`
                                )
                            );
                        }

                        break;
                    }
                }
            }
        });

        const connected = new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error("Timeout połączenia TLS z IMAP.")),
                15000
            );

            socket.once("secureConnect", () => {
                clearTimeout(timeout);
                resolve();
            });

            socket.once("error", reject);
        });

        try {
            await connected;

            await command(
                `LOGIN "${this.escape(this.email)}" "${this.escape(this.password)}"`
            );

            const statusLines = await command(
                'STATUS INBOX (UNSEEN MESSAGES)'
            );

            const statusLine = statusLines.find(
                (line) => line.toUpperCase().startsWith("* STATUS ")
            );

            const unreadMatch = statusLine?.match(/UNSEEN\s+(\d+)/i);
            const messagesMatch = statusLine?.match(/MESSAGES\s+(\d+)/i);

            await command("LOGOUT").catch(() => {});

            return {
                unread: unreadMatch ? Number(unreadMatch[1]) : 0,
                messages: messagesMatch ? Number(messagesMatch[1]) : null
            };
        }
        finally {
            socket.destroy();
        }
    }
}

module.exports = HomePlMailConnector;
