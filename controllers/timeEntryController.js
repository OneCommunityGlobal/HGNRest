var express = require('express');
var moment = require('moment');


var timeEntrycontroller = function(TimeEntry){

    var getAllTimeEnteries = function(req, res){

        TimeEntry.find(function(err, records){
    
            if (err)  {
                console.log("Error encountered during get operation of timelog. Error is "+ err);
                res.status(404).send("Error!!");
            }
            else {
                                
                 var items = [];
                 records.forEach(element => {
    
                    var timeentry = new TimeEntry();
                    
                    timeentry.personId   = element.personId;
                    timeentry.projectId = element.projectId;
                    timeentry.taskId = element.taskId;
                    timeentry.dateofWork = element.dateofWork;
                    timeentry.timeSpent = moment("1900-01-01 00:00:00").add(element.totalSeconds, 'seconds').format("HH:mm:ss");
                    timeentry.notes = element.notes;
                    timeentry.isTangible = element.isTangible;
                  
                    items.push(timeentry);
                 });
                res.json(items).status(200);
            }
        });
    };

    var postTimeEntry = function(req, res){
   
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
        timeentry.isTangible = req.body.isTangible;
        timeentry.createdDateTime = moment.utc();
        timeentry.lastModifiedDateTime =  moment.utc();
        timeentry.rollupYear = moment(dateofWork).get('year');
        timeentry.rollupMonth   =("0"+ moment(dateofWork).get('month')+1).slice(-2) + moment(dateofWork).get('year');
        timeentry.rollupWeek = moment(dateofWork).startOf('week').format("MM/DD/YYYY");   
       
        
    
    
        timeentry.save(function(err){ 
            
            if(err){ 
            res.status(500).send(err);
            }
    
            else {
                
                res.status(200).send("Time Entry saved");
            }
        
        });  
    
        
    
    };

    return{
        getAllTimeEnteries:getAllTimeEnteries,
        postTimeEntry: postTimeEntry
        
    };
};

module.exports = timeEntrycontroller;