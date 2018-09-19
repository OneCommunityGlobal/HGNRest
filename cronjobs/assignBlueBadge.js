var schedule = require('node-schedule');
var moment = require('moment-timezone');
var dashboardhelper = require("../helpers/dashboardhelper")()

//Set the job trigger time as end of iso week day.
var pdtStartOfLastWeek = moment().tz("America/Los_Angeles").startOf("isoWeek").subtract(1, "week").startOf("day").format();
var pdtEndOfLastWeek = moment().tz("America/Los_Angeles").startOf("isoWeek").subtract(1, "week").endOf("day").format();

// run the job at 1 second after pdtendoflastweek

var runAt = moment().tz("America/Los_Angeles").startOf("isoWeek").subtract(1, "week").endOf("day").add(1, "second").format();
runAt = moment().add(5, "seconds").toDate();

var rule = new schedule.RecurrenceRule();
rule.dayOfWeek = moment(runAt).day();
rule.hour = moment(runAt).hour();
rule.minute = moment(runAt).minute();

var assignBlueBadge = function(){
    schedule.scheduleJob('/5 * * * * *', function(){
        var personId = "5ae0afcab3f1241c28c9b4e2"
        dashboardhelper.laborthisweek(personId, pdtStartOfLastWeek, pdtEndOfLastWeek)
        .then(results => {
            console.log('The answer to life, the universe, and everything!', results, Date.now());
        })
        .catch(error => console.log(error))
    
});
}


module.exports = assignBlueBadge;