const mongoose = require('mongoose');
const timeentry = require('../models/timeentry');
const userProject = require('../helpers/helperModels/userProjects');
const userProfile = require('../models/userProfile');

const projectController = function (Project) {
  const getAllProjects = function (req, res) {
    Project.find({}, 'projectName isActive')
      .sort({ projectName: 1 })
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };

  const deleteProject = function (req, res) {
    if (req.body.requestor.role !== 'Administrator') {
      res.status(403).send({ error: 'You are  not authorized to delete projects.' });
      return;
    }
    const { projectId } = req.params;
    Project.findById(projectId, (error, record) => {
      if (error || !record || (record === null) || (record.length === 0)) {
        res.status(400).send({ error: 'No valid records found' });
        return;
      }

      // find if project has any time enteries associated with it

      timeentry.find({ projectId: record._id }, '_id')
        .then((timeentries) => {
          if (timeentries.length > 0) {
            res.status(400).send({ error: 'This project has associated time entries and cannot be deleted. Consider inactivaing it instead.' });
          } else {
            const removeprojectfromprofile = userProfile.updateMany({}, { $pull: { projects: record._id } }).exec();
            const removeproject = record.remove();

            Promise.all([removeprojectfromprofile, removeproject])
              .then(res.status(200).send({ message: ' Project successfully deleted and user profiles updated' }))
              .catch((errors) => { res.status(400).send(errors); });
          }
        });
    })
      .catch((errors) => { res.status(400).send(errors); });
  };

  const postProject = function (req, res) {
    if (req.body.requestor.role !== 'Administrator') {
      res.status(403).send({ error: 'You are not authorized to create new projects.' });
      return;
    }

    if (!req.body.projectName || !req.body.isActive) {
      res.status(400).send({ error: 'Project Name and active status are mandatory fields' });
      return;
    }

    Project.find({ projectName: { $regex: req.body.projectName, $options: 'i' } })
      .then((result) => {
        if (result.length > 0) {
          res.status(400).send({ error: `Project Name must be unique. Another project with name ${result.projectName} already exists. Please note that project names are case insensitive` });
          return;
        }
        const _project = new Project();

        _project.projectName = req.body.projectName;
        _project.isActive = req.body.isActive;
        _project.createdDatetime = Date.now();
        _project.modifiedDatetime = Date.now();

        _project.save()
          .then(results => res.status(201).send(results))
          .catch(error => res.status(500).send({ error }));
      });
  };


  const putProject = function (req, res) {
    if (req.body.requestor.role !== 'Administrator') {
      res.status(403).send('You are not authorized to make changes in the projects.');
      return;
    }

    const { projectId } = req.params;

    Project.findById(projectId, (error, record) => {
      if (error || record === null) {
        res.status(400).send('No valid records found');
        return;
      }

      record.projectName = req.body.projectName;
      record.isActive = req.body.isActive;
      record.modifiedDatetime = Date.now();

      record.save()
        .then(results => res.status(201).send(results._id))
        .catch(errors => res.status(400).send(errors));
    });
  };


  const getProjectById = function (req, res) {
    const { projectId } = req.params;

    Project.findById(projectId, '-__v  -createdDatetime -modifiedDatetime')
      .then(results => res.status(200).send(results))
      .catch(error => res.status(404).send(error));
  };

  const getUserProjects = function (req, res) {
    const { userId } = req.params;

    userProject.findById(userId)
      .then((results) => {
        res.status(200).send(results.projects);
      })
      .catch((error) => { res.status(400).send(error); });
  };

  const assignProjectToUsers = function (req, res) {
    // verify requestor is administrator, projectId is passed in request params and is valid mongoose objectid, and request body contains  an array of users

    if (req.body.requestor.role !== 'Administrator') {
      res.status(403).send({ error: 'You are not authorized to perform this operation' });
      return;
    }

    if (!req.params.projectId || !mongoose.Types.ObjectId.isValid(req.params.projectId) || !req.body.users || (req.body.users.length === 0)) {
      res.status(400).send({ error: 'Invalid request' });
      return;
    }

    // verify project exists

    Project.findById(req.params.projectId)
      .then((project) => {
        if (!project || (project.length === 0)) {
          res.status(400).send({ error: 'Invalid project' });
          return;
        }
        const { users } = req.body;
        const assignlist = [];
        const unassignlist = [];

        users.forEach((element) => {
          const { userId, operation } = element;
          if (operation === 'Assign') { assignlist.push(userId); } else { unassignlist.push(userId); }
        });

        const assignPromise = userProfile.updateMany({ _id: { $in: assignlist } }, { $addToSet: { projects: project._id } }).exec();
        const unassignPromise = userProfile.updateMany({ _id: { $in: unassignlist } }, { $pull: { projects: project._id } }).exec();

        Promise.all([assignPromise, unassignPromise])
          .then(() => {
            res.status(200).send({ result: 'Done' });
          })
          .catch((error) => {
            res.status(500).send({ error });
          });
      })
      .catch((error) => {
        res.status(500).send({ error });
      });
  };

  const getprojectMembership = function (req, res) {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      res.status(400).send({ error: 'Invalid request' });
      return;
    }
    userProfile.find({ projects: projectId }, '_id firstName lastName profilePic')
      .sort({ firstName: 1, lastName: 1 })
      .then((results) => { res.status(200).send(results); })
      .catch((error) => { res.status(500).send(error); });
  };

  return {
    getAllProjects,
    postProject,
    getProjectById,
    putProject,
    deleteProject,
    getUserProjects,
    assignProjectToUsers,
    getprojectMembership,
  };
};


module.exports = projectController;
