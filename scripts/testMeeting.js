const MeetingAgent = require("../agents/meeting/MeetingAgent");

(async () => {

    const meeting = new MeetingAgent();

    const report = await meeting.summarize(`
Spotkanie z firmą ABC.

Ustalono rozpoczęcie prac 15 lipca.

Jan przygotuje ofertę.

Anna wyśle dokumentację.

Kolejne spotkanie odbędzie się za tydzień.
`);

    console.log(report);

})();