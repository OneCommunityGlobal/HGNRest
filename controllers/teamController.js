var teamcontroller = function (team) {

  var getAllTeams = function (req, res) {

    team.find({})
      .then(results => res.send(results).status(200))
      .catch(error => res.send(error).status(404));

  };
  var getTeamById = function (req, res) {
    var teamId = req.params.teamId;

    team.findById(teamId)
      .then(results => res.send(results).status(200))
      .catch(error => res.send(error).status(404));


  };
  var postTeam = function (req, res) {

    var _team = new team();

    _team.teamName = req.body.teamName;
    _team.createdDatetime = Date.now();
    _team.modifiedDatetime = Date.now();

    _team.save()
      .then(results => res.send(results).status(200))
      .catch(error => res.send(error).status(404));

  };
  var deleteTeam = function (req, res) {
    if (req.body.requestor.role !== "Administrator") {
      res.status(403).send("You are not authorized to delete teams.");
      return;
    }
    var teamId = req.params.teamId;
    team.findById(teamId, function (error, record) {

      if (error || record == null) {
        res.status(400).send("No valid records found");
        return;
      }
      record.remove()
        .then(res.status(200).send("Removed"))
        .catch(errors => { res.status(400).send(error) });
    })
      .catch(errors => { res.status(400).send(error) });

  };
  var putTeam = function (req, res) {

    if (req.body.requestor.role !== "Administrator") {
      res.status(403).send("You are not authorized to make changes in the teams.");
      return;
    }

    var teamId = req.params.teamId;

    team.findById(teamId, function (error, record) {

      if (error || record == null) {
        res.status(400).send("No valid records found");
        return;
      }
      record.teamName = req.body.teamName;
      record.createdDatetime = Date.now();
      record.modifiedDatetime = Date.now();

      record.save()
        .then(results => res.status(201).send(results._id))
        .catch(error => res.status(400).send(error));

    }

    );

  };

  return {
    getAllTeams: getAllTeams,
    getTeamById: getTeamById,
    postTeam: postTeam,
    deleteTeam: deleteTeam,
    putTeam: putTeam
  };

};

module.exports = teamcontroller;
