var express = require('express');

var routes = function(Profile){

    
    
    var ProfileRouter = express.Router();
    ProfileRouter.route('/Profiles')
        .get(function(req,res){
    
            Profile.find(function(err, profiles){
                if(err) res.status(404).send("Error finding profiles");
                res.json(profiles);
            })
    
        });

        return ProfileRouter;

};



module.exports = routes;