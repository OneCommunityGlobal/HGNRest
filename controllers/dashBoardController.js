var userProfile = require('./models/userProfile');
var TimeEntry = require('./models/timeentry');


var dashboardcontroller = function(){

    var teamid= ""
    var personaldetails = function(){
       
       ;
        var profiledata;

        var userid = "5a2ede09f080621198106091"; /* TODO: Get user id so that details can be retrrived */
        userProfile.findById(userid, function(err, record){
            
            this.profiledata = record;
            this.teamid = record.teamid;
          });
          return profiledata;
    }

    var leaderBoardData = function(){

       var query = userProfile.find({teamid :teamid, isActive: true})
                        .select('_id, firstname, lastname')
                        .exec();

        console.log(query);
        }
    
    
        return {
            personaldetails: personaldetails,
            leaderBoardData: leaderBoardData


        }


}();

module.exports = dashboardcontroller;

dashboardcontroller.leaderBoardData;