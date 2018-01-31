var teamcontroller = function (team) {

  var getAllTeams = function (req, res) {

    team.find({})
    .then(results => res.send(results).status(200))
    .catch(error => res.send(error).status(404));

  };
  var getTeamById = function(req, res){
      var teamId = req.params.teamId;

    team.findById(teamId)
    .then(results => res.send(results).status(200))
    .catch(error => res.send(error).status(404));


  };
  var postTeam = function(req, res){

    var _team = new team();

    _team.teamName = req.body.teamName;
    _team.projectId = req.body.projectId;
    _team.createdDatetime = Date.now();
    _team.modifiedDatetime = Date.now();    

    _team.save()
    .then(results => res.send(results).status(200))
    .catch(error => res.send(error).status(404));

  };

  return{
    getAllTeams:getAllTeams,
    getTeamById: getTeamById,
    postTeam:postTeam
  };

};

module.exports = teamcontroller;
