var express = require('express');

var routes = function(TimeEntry, Profile){

    Dashboardrouter = express.Router();

    Dashboardrouter.route('/dashboard1')
    .get(function (req, res){

        Console.log("Landed in get function");

        TimeEntry.aggregate([{$lookup : {
            
            "from": "profiles",
            "localField": "PersonId",
            foreignField : "_id",
            as: "persondata"      
            }}    ,{$project : {
                TimeLogid: "$_id",PersonId : {$arrayElemAt: ["$persondata._id",0]}, LoggedDate: "$createdDate", _id:0,
                rollupweek:1, rollupmonth:1, rollupyear:1, totalseconds:1, 
                Name : {$concat : [{$arrayElemAt: ["$persondata.name",0]}]}
              }}
        
                
            ], function(err, items){

                if (err) {
                    res.send("Error processing data!!!");
                    res.status('404');
                }

                else
                {
                    res.status(200);
                    res.json(items);

                }
            })



    });

    return Dashboardrouter;

}

module.exports = routes;

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