const Planner = require("../core/planner/Planner");

const planner = new Planner();

const plan = planner.createPlan({

    task: "WRITE_EMAIL"

});

console.log(plan);