var mongoose = require('mongoose'),

Schema = mongoose.Schema;


var personschema = new Schema({

    name : {type : String , required: true},
    role : {type : String , required: true}
});

var leaderboard_week = new Schema({

    name : {type: string, required: true},
    hours : {type: numner, required: true}

});
var leaderboard_month = new Schema({
    
        name : {type: string, required: true},
        hours : {type: numner, required: true}
    
    });

var leaderboard_year = new Schema({
        
            name : {type: string, required: true},
            hours : {type: numner, required: true}
        
        });

var leaderboard_alltime = new Schema({
            
                name : {type: string, required: true},
                hours : {type: numner, required: true}
            
            });

var leaderboard = new Schema({
 leaderboard_week,
 leaderboard_month,
 leaderboard_year,
 leaderboard_alltime
});


var dashboardschema = new Schema(
{

    

}
);