var express = require('express');

var routes = function(TimeEntry){

var TimeEntryRouter = express.Router();
var moment = require('moment');
TimeEntryRouter.route('/TimeEntry')
.get(function(req, res){

    TimeEntry.find(function(err, records){

        if (err)  {
            console.log("Error encountered during get operation of timelog. Error is "+ err);
            res.status(404).send("Error!!")
        }
        else {
            res.status(200);
            res.json(records);
        }
    })
})
.post(function(req, res){
   
    var timeentry = new TimeEntry();
    var dateofWork = req.body.dateofWork;
    var date = new Date();
    
    timeentry.personId   = req.body.personId;
	timeentry.projectId = req.body.projectId;
	timeentry.taskId = req.body.taskId;
	timeentry.dateofwork = moment(dateofWork);
	timeentry.totalSeconds = req.body.totalSeconds;
	timeentry.notes = req.body.notes;
	timeentry.tangible = req.body.tangible;
	timeentry.createdDateTime = moment.utc();
	timeentry.lastModifiedDateTime =  moment.utc();
    timeentry.rollupYear = moment(dateofWork).get('year');
    timeentry.rollupMonth   =("0"+ moment(dateofWork).get('month')+1).slice(-2) + moment(dateofWork).get('year');
    timeentry.rollupWeek = moment(dateofWork).startOf('week').format("MM/DD/YYYY");

    
   
	


    timeentry.save(function(err){ 
        
        if(err){ 
        res.status("500").send(err);
        }

        else {
            
            res.status(200).send("Time Entry saved");
        }
    
    });  

    

})

return TimeEntryRouter;
}

module.exports = routes;


