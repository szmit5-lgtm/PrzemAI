require("dotenv").config();

const MailAgent = require("../agents/mail/MailAgent");

(async () => {

    const mail = new MailAgent();

    const answer = await mail.write(
        "Napisz maila do klienta z podziękowaniem za spotkanie i potwierdzeniem dalszej współpracy."
    );

    console.log();
    console.log(answer);

})();