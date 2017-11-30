var HttpStatus = require('http-status-codes');

var express = require('express')

var routes = function(TimeLog){

var TimeLogRouter = express.Router();

TimeLogRouter.route('/TimeLogs')
.get(function(req, res){

    TimeLog.find(function(err, timelogs){

        if (err)  {
            console.log("Error encountered during get operation of timelog. Error is "+ err);
            res.status(404).send("Error!!")
        }
        else {
            res.status(HttpStatus.OK);
            res.json(timelogs);
        }
    })
})
.post(function(req, res){

    var date = new Date();
    var timelog = new TimeLog();

    timelog.createdDate = date.getDate();
    timelog.lastModifiedDate = date.getDate();
    timelog.totalSeconds = req.body.totalSeconds;
    timelog.tangible = req.body.tangible;
    timelog.workCompletedDescription = req.body.workCompletedDescription;
    timelog.project = req.body.project;
    timelog.task = req.body.task;

    timelog.save();  

    res.status(200).send("Timelog saved");

})

return TimeLogRouter;
}

module.exports = routes;


