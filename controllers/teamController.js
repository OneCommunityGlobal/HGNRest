var userProfile = require("../models/userProfile");
var mongoose = require("mongoose");

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
    _team.isACtive = req.body.isActive;
    _team.createdDatetime = Date.now();
    _team.modifiedDatetime = Date.now();

    _team.save()
      .then(results => res.send(results).status(200))
      .catch(error => res.send(error).status(404));

  };
  var deleteTeam = function (req, res) {
    if (req.body.requestor.role !== "Administrator") {
      res.status(403).send({ "error": "You are not authorized to delete teams." });
      return;
    }
    var teamId = req.params.teamId;
    team.findById(teamId, function (error, record) {

      if (error || record == null) {
        res.status(400).send({ "error": "No valid records found" });
        return;
      }
      let removeteamfromprofile = userProfile.updateMany({}, { $pull: { teams: record._id } }).exec();
      let deleteteam = record.remove();

      Promise.all([removeteamfromprofile, deleteteam])
        .then(res.status(200).send({ "message": " Team successfully deleted and user profiles updated" }))
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
      record.isActive = req.body.isACtive;
      record.createdDatetime = Date.now();
      record.modifiedDatetime = Date.now();

      record.save()
        .then(results => res.status(201).send(results._id))
        .catch(error => res.status(400).send(error));

    }

    );

  };

  var assignTeamToUsers = function (req, res) {

    //verify requestor is administrator, teamId is passed in request params and is valid mongoose objectid, and request body contains  an array of users

    if (req.body.requestor.role != "Administrator") {
      res.status(403).send({ "error": "You are not authorized to perform this operation" });
      return;
    }

    if (!req.params.teamId || !mongoose.Types.ObjectId.isValid(req.params.teamId) || !req.body.users || (req.body.users.length == 0)) {
      res.status(400).send({ "error": "Invalid request" });
      return;
    }

    //verify project exists

    team.findById(req.params.teamId)
      .then(team => {
        if (!team || (team.length == 0)) {
          res.status(400).send({ "error": "Invalid team" });
          return;
        }
        let users = req.body.users;
        var assignlist = [];
        var unassignlist = [];

        users.forEach(element => {
          let userId = element.userId;
          let operation = element.operation;
          (operation == "Assign") ? assignlist.push(userId) : ((operation == "Unassign") ? unassignlist.push(userId) : "");

        })

        let assignPromise = userProfile.updateMany({ _id: { $in: assignlist } }, { $addToSet: { team: team._id } }).exec();
        let unassignPromise = userProfile.updateMany({ _id: { $in: unassignlist } }, { $pull: { teams: team._id } }).exec()

        Promise.all([assignPromise, unassignPromise])
          .then((results) => {
            res.status(200).send({ "result": "Done" });
            return;
          })
          .catch(error => {
            res.status(500).send({ "error": error });
            return;
          })

      })
      .catch(error => {
        res.status(500).send({ "error": error });
        return;
      })

  }

  return {
    getAllTeams: getAllTeams,
    getTeamById: getTeamById,
    postTeam: postTeam,
    deleteTeam: deleteTeam,
    putTeam: putTeam,
    assignTeamToUsers: assignTeamToUsers
  };

};

module.exports = teamcontroller;
