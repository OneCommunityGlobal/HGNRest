var timeentry = require('../models/timeentry');
var mongoose = require("mongoose");
var userProject = require('../helpers/helperModels/userProjects');
var userProfile = require("../models/userProfile");

var projectController = function (project) {


  var getAllProjects = function (req, res) {

    project.find({}, 'projectName isActive')
      .sort({ projectName: 1 })
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));

  };

  var deleteProject = function (req, res) {

    if (req.body.requestor.role !== "Administrator") {
      res.status(403).send({ "error": "You are  not authorized to delete projects." });
      return;
    }
    var projectId = req.params.projectId;
    project.findById(projectId, function (error, record) {

      if (error || !record || (record === null) || (record.length == 0)) {
        res.status(400).send({ "error": "No valid records found" });
        return;
      }

      //find if project has any time enteries associated with it

      timeentry.find({ projectId: record._id }, "_id")
        .then((timeentries) => {

          if (timeentries.length > 0) {
            res.status(400).send({ "error": "This project has associated time entries and cannot be deleted. Consider inactivaing it instead." });
            return;
          }
          else {

            let removeprojectfromprofile = userProfile.updateMany({}, { $pull: { projects: record._id } }).exec();
            let removeprojectfromprofile = record.remove();

            Promise.all([removeprojectfromprofile, removeprojectfromprofile])
              .then(res.status(200).send({ "message": " Project successfully deleted and user profiles updated" }))
              .catch(errors => { res.status(400).send(error) });

          }

        });

    })
      .catch(errors => { res.status(400).send(error) });

  };

  var postProject = function (req, res) {

    if (req.body.requestor.role !== "Administrator") {
      res.status(403).send({ "error": "You are not authorized to create new projects." });
      return;
    }

    if (!req.body.projectName || !req.body.isActive) {
      res.status(400).send({ "error": "Project Name and active status are mandatory fields" });
      return;
    }

    project.find({ projectName: { $regex: req.body.projectName, $options: 'i' } })
      .then((result) => {
        if (result.length > 0) {
          res.status(400).send({ "error": `Project Name must be unique. Another project with name ${result.projectName} already exists. Please note that project names are case insensitive` });
          return;
        }
        var _project = new project();

        _project.projectName = req.body.projectName;
        _project.isActive = req.body.isActive;
        _project.createdDatetime = Date.now();
        _project.modifiedDatetime = Date.now();

        _project.save()
          .then(results => res.status(201).send(results))
          .catch(error => res.status(500).send({ "error": error }));
      })
  };


  var putProject = function (req, res) {

    if (req.body.requestor.role !== "Administrator") {
      res.status(403).send("You are not authorized to make changes in the projects.");
      return;
    }

    var projectId = req.params.projectId;

    project.findById(projectId, function (error, record) {

      if (error || record == null) {
        res.status(400).send("No valid records found");
        return;
      }

      record.projectName = req.body.projectName;
      record.isActive = req.body.isActive;
      record.modifiedDatetime = Date.now();

      record.save()
        .then(results => res.status(201).send(results._id))
        .catch(error => res.status(400).send(error));
    }

    );

  };


  var getProjectById = function (req, res) {

    var projectId = req.params.projectId;

    project.findById(projectId, '-__v  -createdDatetime -modifiedDatetime')
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));

  };

  var getUserProjects = function (req, res) {
    var userId = req.params.userId;

    userProject.findById(userId)
      .then(results => {
        res.status(200).send(results.projects);
        return;
      })
      .catch(error => { res.status(400).send(error); return; });

  }

  var assignProjectToUsers = function (req, res) {

    //verify requestor is administrator, projectId is passed in request params and is valid mongoose objectid, and request body contains  an array of users

    if (req.body.requestor.role != "Administrator") {
      res.status(403).send({ "error": "You are not authorized to perform this operation" });
      return;
    }

    if (!req.params.projectId || !mongoose.Types.ObjectId.isValid(req.params.projectId) || !req.body.users || (req.body.users.length == 0)) {
      res.status(400).send({ "error": "Invalid request" });
      return;
    }

    //verify project exists

    project.findById(req.params.projectId)
      .then(project => {
        if (!project || (project.length == 0)) {
          res.status(400).send({ "error": "Invalid project" });
          return;
        }
        let users = req.body.users;
        var assignlist = [];
        var unassignlist = [];

        users.forEach(element => {
          let userId = element.userId;
          let operation = element.operation;
          (operation == "Assign") ? assignlist.push(userId) : ((operation == "Unassign") ? unassignlist.push(userId) : "");
        });

        let assignPromise = userProfile.updateMany({ _id: { $in: assignlist } }, { $addToSet: { projects: project._id } }).exec();
        let unassignPromise = userProfile.updateMany({ _id: { $in: unassignlist } }, { $pull: { projects: project._id } }).exec()

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
      .catch((error) => {
        res.status(500).send({ "error": error });
        return;
      })

  }

  var getprojectMembership = function (req, res) {
    var projectId = req.params.projectId;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      res.status(400).send({ "error": "Invalid request" })
      return;
    }
    userProfile.find({ projects: projectId }, '_id firstName lastName')
      .sort({ firstName: 1, lastName: 1 })
      .then(results => { res.status(200).send(results) })
      .catch(error => { res.status(500).send(error) });
  }

  return {
    getAllProjects: getAllProjects,
    postProject: postProject,
    getProjectById: getProjectById,
    putProject: putProject,
    deleteProject: deleteProject,
    getUserProjects: getUserProjects,
    assignProjectToUsers: assignProjectToUsers,
    getprojectMembership: getprojectMembership
  };

};


module.exports = projectController;
