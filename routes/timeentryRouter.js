var express = require('express');

var routes = function(TimeEntry){

var TimeEntryRouter = express.Router();
var moment = require('moment');
TimeEntryRouter.route('/TimeEntry')
.get(function(req, res){

    TimeEntry.find(function(err, records){

        if (err)  {
            console.log("Error encountered during get operation of timelog. Error is "+ err);
            res.status(404).send("Error!!");
        }
        else {
            res.status(200);
             console.log(records);
             var items = [];
             records.forEach(element => {

                var timeentry = new TimeEntry();
                
                timeentry.personId   = element.personId;
                timeentry.projectId = element.projectId;
                timeentry.taskId = element.taskId;
                timeentry.dateofWork = element.dateofWork;
                timeentry.timeSpent = moment("1900-01-01 00:00:00").add(element.totalSeconds, 'seconds').format("HH:mm:ss");
                timeentry.notes = element.notes;
                timeentry.tangible = element.tangible;
              
                items.push(timeentry);
             });
            res.json(items);
        }
    })
})
.post(function(req, res){
   
    var timeentry = new TimeEntry();
    var dateofWork = req.body.dateofWork;
    var date = new Date();
    var timeSpent = req.body.timeSpent;
   
    
    timeentry.personId   = req.body.personId;
	timeentry.projectId = req.body.projectId;
	timeentry.taskId = req.body.taskId;
	timeentry.dateofWork = moment(dateofWork);
	timeentry.totalSeconds = moment.duration(timeSpent).asSeconds();
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


