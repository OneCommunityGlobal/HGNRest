var timeentry = require('../models/timeentry');
var mongoose = require("mongoose");

var projectController = function (project) {


  var getAllProjects = function (req, res) {

    project.find({}, 'projectName isActive')
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


      if (error || !record || (record === null)) {
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
            record.remove()
              .then(res.status(200).send({ "message": `${record._id} deleted` }))
              .catch(errors => { res.status(400).send(error) });
          }

        })



    })
      .catch(errors => { res.status(400).send(error) });

  };

  var postProject = function (req, res) {

    if (req.body.requestor.role !== "Administrator") {
      res.status(403).send("You are not authorized to create new projects.");
      return;
    }

    var _project = new project();

    _project.projectName = req.body.projectName;
    _project.isActive = req.body.isActive;
    _project.createdDatetime = Date.now();
    _project.modifiedDatetime = Date.now();

    _project.save()
      .then(results => res.status(201).send(results._id))
      .catch(error => res.status(404).send(error));

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

  return {
    getAllProjects: getAllProjects,
    postProject: postProject,
    getProjectById: getProjectById,
    putProject: putProject,
    deleteProject: deleteProject
  };

};


module.exports = projectController;
