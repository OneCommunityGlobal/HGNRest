var express = require('express');

var route = function(TimeEntry, userProfile){

    var controller = require('../controllers/dashBoardController')();


    var Dashboardrouter = express.Router();

    Dashboardrouter.route('/dashboard1/:userId')
    .get(controller.dashboarddata);

    return Dashboardrouter;

}

module.exports = route;

/*

db.TimeEntry.aggregate([{$lookup : {
    
    "from": "Person",
    "localField": "PersonId",
    foreignField : "_id",
    as: "persondata"      
    }}
    ,{$project : {
        TimeLogid: "$_id",PersonId : {$arrayElemAt: ["$persondata._id",0]}, LoggedDate: "$createdDate", _id:0,
        rollupweek:1, rollupmonth:1, rollupyear:1, totalseconds:1, 
        Name : {$concat : [{$arrayElemAt: ["$persondata.FirstName",0]}, " " , {$arrayElemAt: ["$persondata.LastName",0]}]}
      }}
        
    ])
*/

/*

        TimeEntry.aggregate([{$lookup : {
            
            from: Profile,
            localField: personId,
            foreignField : _id,
            as: persondata      
            }}  
            ,{$project : {
                TimeLogid: "$_id",PersonId : {$arrayElemAt: ["$persondata._id",0]}, LoggedDate: "$dateOfWork", _id:0,
                rollupWeek:1, rollupMonth:1, rollupYear:1, totalSeconds:1, 
                Name : {$concat : [{$arrayElemAt: ["$persondata.name",0]}]}
              }}
        
                
            ], function(err, items){

                if (err) {
                    res.send(err);
                    res.status('404');
                }

                else
                {
                    res.status(200);
                    res.json(items);

                }
            })
       
*/